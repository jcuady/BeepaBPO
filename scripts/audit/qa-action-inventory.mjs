// Inventory the exported server actions in lib/, so "N of 81 exercised" is a
// number a script produces rather than a number someone maintained by hand.
//
// WHY: the coverage figure in docs/QA_REPORT.md §5 had drifted. It listed
// `lib/attendance/*` as holding 8 actions; `lib/attendance/actions.ts` — the only
// "use server" module in that tree — exports 2. A hand-kept table is a claim, and
// this whole pass has been about refusing to let claims stand in for evidence.
//
// WHAT COUNTS: a file whose first ~400 characters contain the "use server"
// directive, counting `export async function NAME`. A "use server" module may only
// export async functions, so anything else exported from one is either a type
// (erased at runtime) or a violation worth surfacing.
//
// Usage: node scripts/audit/qa-action-inventory.mjs [--md]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const AS_MD = process.argv.includes("--md");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/**
 * Strip comments before looking for the "use server" directive.
 *
 * Without this the scan reads prose as code. `lib/auth/error-messages.ts` opens
 * with a doc comment explaining that it was deliberately kept OUT of a "use
 * server" module — and that sentence is all it takes for the file to be counted
 * as one, its two pure helpers flagged as illegal exports, and the whole
 * inventory reported as a failure. Same family as the comment-stripping trap in
 * `tests/auth-signout-scope.test.ts`: a scanner that reads a docstring as a
 * statement invents findings, and an audit that cries wolf gets ignored.
 */
function stripComments(source) {
  return source
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().startsWith("//")) return "";
      const idx = line.indexOf("//");
      // The `://` guard keeps URL literals such as "https://..." intact.
      return idx === -1 || line.slice(0, idx).includes(":") ? line : line.slice(0, idx);
    })
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

const modules = [];
for (const file of walk(join(ROOT, "lib"))) {
  const source = readFileSync(file, "utf8");
  // The directive must be a real statement, so test the stripped text.
  if (!/["']use server["']/.test(stripComments(source).slice(0, 400))) continue;
  const actions = [...source.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
  // Non-async exports from a "use server" module are a real Next.js constraint
  // violation, not a style nit — surface them rather than silently dropping them.
  const nonAsyncExports = [...source.matchAll(/export\s+(?!async)(?!type\b|interface\b|declare\b)(?:const|function|class|let|var)\s+(\w+)/g)]
    .map((m) => m[1]);
  if (!actions.length && !nonAsyncExports.length) continue;
  modules.push({
    file: relative(ROOT, file).replace(/\\/g, "/"),
    actions,
    nonAsyncExports,
  });
}

modules.sort((a, b) => a.file.localeCompare(b.file));
const total = modules.reduce((n, m) => n + m.actions.length, 0);
const violations = modules.filter((m) => m.nonAsyncExports.length);

console.log(`${modules.length} "use server" module(s), ${total} exported async action(s)\n`);
for (const m of modules) {
  console.log(`${String(m.actions.length).padStart(3)}  ${m.file}`);
  if (m.actions.length) console.log(`     ${m.actions.join(", ")}`);
  if (m.nonAsyncExports.length) {
    console.log(`     !! non-async exports (illegal in a "use server" module): ${m.nonAsyncExports.join(", ")}`);
  }
}

if (violations.length) {
  console.error(`\nFAIL: ${violations.length} module(s) export non-async values from "use server".`);
  process.exitCode = 1;
}

if (AS_MD) {
  console.log("\n| Module | Actions | Names |");
  console.log("|---|---|---|");
  for (const m of modules) {
    console.log(`| \`${m.file}\` | ${m.actions.length} | ${m.actions.map((a) => `\`${a}\``).join(", ")} |`);
  }
  console.log(`| **Total** | **${total}** | |`);
}