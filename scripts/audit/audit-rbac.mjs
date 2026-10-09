// RBAC audit: walk every /app page and report the auth gating it uses.
//
// Two things this must get right or it produces false "ungated" reports:
//
//  1. Gating is expressed in several equivalent forms — requirePermission(),
//     requireInternal()/requireClient()/requireApplicantOnly(), and
//     canAny(workspace.permissions, [...]) followed by forbidden(). A page is
//     gated if ANY of them rejects.
//
//  2. Several hub routes are one-line re-exports of a shared page component that
//     owns its own gate, e.g.
//         app/app/payroll/page.tsx  ->  export default PayrollAdminPage;
//         lib/app/admin-pages.tsx   ->  export async function PayrollAdminPage()
//     Scanning only the page file reports those routes as ungated. This script
//     resolves the re-export and folds in the gate from the implementation.
import { readFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve, dirname, join, relative } from "node:path";

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name === "page.tsx" || entry.name === "layout.tsx") yield path;
  }
}

const FILES = [];
for await (const p of walk("app/app")) {
  // Store cwd-relative POSIX paths so route labels below are readable.
  FILES.push(relative(process.cwd(), p).split(/[/\\]/).join("/"));
}

// Load the parent layout's gate signature — pages inheriting from it are gated.
const layoutFile = "app/app/layout.tsx";
let parentLayoutGates = false;
try {
  const src = readFileSync(layoutFile, "utf8");
  parentLayoutGates =
    /resolveWorkspace\(\)/.test(src) &&
    /if\s*\(\s*!\s*workspace\s*\)/.test(src) &&
    /redirect\(/.test(src);
} catch {}

/**
 * Follow `export default <Identifier>;` re-exports into the module that defines
 * the identifier, recursively, and return page source + implementation source
 * concatenated so the gate scan sees both.
 */
function resolveGateSource(file, seen = new Set(), depth = 0) {
  const src = readFileSync(file, "utf8");
  if (depth > 4 || seen.has(file)) return { src, via: [] };
  seen.add(file);

  // Only a bare `export default Identifier;` delegates; a default function
  // definition or `export default function` keeps the gate in this file.
  const bare = [...src.matchAll(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/g)].map((m) => m[1]);
  if (bare.length === 0) return { src, via: [] };

  let combined = src;
  const via = [];
  for (const name of bare) {
    const braced = src.match(
      new RegExp(`import\\s*{[^}]*\\b${name}\\b[^}]*}\\s*from\\s*["']([^"']+)["']`),
    );
    const bare2 = src.match(new RegExp(`import\\s+${name}\\s+from\\s*["']([^"']+)["']`));
    const spec = braced?.[1] ?? bare2?.[1];
    if (!spec) continue;

    const base = spec.startsWith("@/")
      ? resolve(process.cwd(), spec.slice(2))
      : spec.startsWith(".")
        ? resolve(dirname(file), spec)
        : null;
    if (!base) continue;

    const target = ["", ".tsx", ".ts"].map((ext) => `${base}${ext}`).find((p) => existsSync(p));
    if (!target) continue;

    const nested = resolveGateSource(target, seen, depth + 1);
    combined += `\n${nested.src}`;
    via.push(target, ...nested.via);
  }
  return { src: combined, via };
}

function checks(src) {
  return {
    requiresWorkspace: /resolveWorkspace\(\)/.test(src),
    redirectIfNone: /if\s*\(!\s*workspace\s*\)\s*redirect/.test(src),
    requireInternal: /requireInternal\(|!\s*workspace\.isInternal/.test(src),
    requireClient: /requireClient\(|!\s*workspace\.isClient/.test(src),
    requireApplicant: /requireApplicantOnly\(|!\s*workspace\.isApplicant/.test(src),
    requirePermission: /requirePermission\(/.test(src),
    requireAny: /canAny\(/.test(src),
    denyViaForbidden: /forbidden\(\)/.test(src),
    redirectTo: (src.match(/redirect\(\s*["']\/([\w/-]+)/g) || []).map((s) => s.replace(/^redirect\(\s*["']\//, "")),
  };
}

const AUTHORIZES = (c) =>
  c.requireInternal || c.requireClient || c.requireApplicant || c.requirePermission || c.requireAny;

/**
 * Gates compose down the route tree: app/app/my/layout.tsx protects every
 * /app/my/* page, app/app/client/layout.tsx protects every /app/client/* page.
 * Collect the page plus every ancestor layout so an inherited gate counts.
 */
function gateChain(file, delegatedSrc) {
  const chain = [{ file, ...checks(delegatedSrc ? delegatedSrc : readFileSync(file, "utf8")) }];
  let cur = dirname(file);
  const root = resolve("app/app");
  while (cur && resolve(cur) !== root) {
    const layout = join(cur, "layout.tsx");
    if (existsSync(layout)) {
      chain.push({ file: layout, ...checks(readFileSync(layout, "utf8")) });
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return chain;
}

let total = 0;
let gated = 0;
const ungated = [];
const rows = [];

// These three are structural, not data routes, and must not be authorization
// gated: the root layout *is* the authentication gate, /app only redirects to
// the caller's role landing, and /app/access-denied is the 403 destination.
const EXPECTED_UNGATED = new Set([
  resolve("app/app/layout.tsx"),
  resolve("app/app/page.tsx"),
  resolve("app/app/access-denied/page.tsx"),
]);

for (const f of FILES.sort()) {
  const { src, via } = resolveGateSource(f);
  const chain = gateChain(f, src);
  total++;

  // Authentication (resolveWorkspace + redirect) alone is NOT authorization.
  // The page counts as gated only when the page itself or an ancestor layout
  // applies an explicit authorization check.
  const authorizing = chain.filter(AUTHORIZES);
  const isGated = authorizing.length > 0 && parentLayoutGates;

  if (isGated) gated++;
  else if (!EXPECTED_UNGATED.has(resolve(f))) ungated.push({ file: f, via });

  const merged = Object.assign({}, ...chain);
  const route =
    "/" +
    f
      .replace(/^app[/\\]/, "")
      .replace(/[/\\]page\.tsx$/, "")
      .replace(/[/\\]\([a-z_]+\)[/\\]/g, "/")
      .replace(/\[/g, ":")
      .replace(/\]/g, "");
  rows.push({ route, file: f, via, gates: authorizing.map((g) => g.file), ...merged });
}

const expectedUngated = FILES.filter((f) => EXPECTED_UNGATED.has(resolve(f))).length;
console.log(`Pages audited: ${total}  (${expectedUngated} structural, gate-exempt by design)`);
console.log(`Gated:         ${gated}/${total} (${total ? Math.round((gated / total) * 100) : 0}%)`);

if (ungated.length) {
  console.log(`\n!! ${ungated.length} pages with NO authorization check:`);
  for (const { file, via } of ungated) {
    console.log(`  - ${file.replace(/^app[/\\]/, "").replace(/[/\\]page\.tsx$/, "")}`);
    if (via.length) console.log(`      (gate would resolve via ${via.join(", ")})`);
  }
} else {
  console.log("Every audited page applies an explicit authorization check.");
}

// Admin routes must additionally demand a system-level permission.
const adminIssues = rows.filter(
  (r) => r.route.includes("/admin") && !r.requirePermission && !r.requireAny,
);
if (adminIssues.length) {
  console.log(`\n!! ${adminIssues.length} admin pages without a system permission check:`);
  for (const r of adminIssues) console.log(`  - ${r.route}`);
} else {
  console.log("All /admin routes demand an explicit permission.");
}

const groups = {};
for (const r of rows) {
  // route is "/app/<section>/...", so the section name is segment index 2.
  const prefix = r.route.split("/").slice(2, 3)[0] || "(root)";
  if (!groups[prefix]) groups[prefix] = { total: 0, gated: 0 };
  groups[prefix].total++;
  if (parentLayoutGates && AUTHORIZES(r)) groups[prefix].gated++;
}
console.log("\nAuthorization by section (gated/total):");
for (const [k, v] of Object.entries(groups).sort()) {
  const flag = v.gated === v.total ? "" : "   <-- REVIEW";
  console.log(`  ${k.padEnd(15)} ${v.gated}/${v.total}${flag}`);
}

process.exit(ungated.length ? 1 : 0);