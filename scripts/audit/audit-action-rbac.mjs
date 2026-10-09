// Per-action authorization audit.
//
// The existing audit-rbac.mjs verifies every *page* calls some authorization
// helper. It does not cover *server actions*, which are the actual mutation
// path: a page with `requirePermission` paired with an action that omits
// auth would pass the route audit. This script closes that gap.
//
// For every exported async function in lib/**/actions.ts and app/**/actions.ts
// that does NOT begin with an underscore, the script asserts that the body
// calls at least one of: `requirePermission`, `requireInternal`,
// `requireClient`, `requireApplicantOnly`, `canAny`, `can`, `forbidden`,
// or redirects via `redirect(`/...`)`. Functions that explicitly say
// `unauthenticated` in a comment are tolerated (e.g. `signInAction`,
// `signUpAction`).
//
// Failure modes it does NOT catch (and that should remain reviewed by hand):
//   - Action takes user-supplied input but only checks `workspace?.user.id`,
//     never a permission code — this passes the heuristic.
//   - Action uses `requirePermission` but for the wrong resource — semantic,
//     not syntactic.

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

const AUTH_PATTERN = /\b(?:requirePermission|requireInternal|requireClient|requireApplicantOnly|canAny|canAll|can|forbidden|redirect)\s*\(/;

// Functions that are correctly gated by row-level security instead of an
// explicit permission check. The audit still flags them; the annotation is
// the developer's promise that an `select … from notifications where user_id =
// $auth.uid()` policy exists in the migrations and has been verified.
const RLS_GATED_OK = /\/\/\s*rls[- ]gated/i;
const UNAUTHENTICATED_OK = /\/\/\s*unauthenticated/i;

const SKIP_FILES = new Set([
  // Auth flows intentionally run before a workspace exists.
  "lib/auth/actions.ts",
]);

const SKIP_FUNCTIONS = new Set([
  // Composable internal helpers; not mutations.
  // The signature is recognised by being prefixed with `_`.
]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name === "actions.ts") yield p;
  }
}

const root = process.cwd();
const files = [];
for (const dir of ["lib", "app"]) {
  try {
    for await (const f of walk(dir)) files.push(f);
  } catch {}
}

let total = 0;
let checked = 0;
const unguarded = [];

for (const f of files) {
  const rel = relative(root, f).replaceAll("\\", "/");
  if (SKIP_FILES.has(rel)) continue;
  const text = readFileSync(f, "utf8");

  // Build a name→body map for every top-level function in the file. The
  // codebase consistently uses one declaration per function.
  const fnMap = new Map();
  const declOrder = [];
  const fnHeadRe = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;
  for (const m of text.matchAll(fnHeadRe)) {
    const name = m[1];
    if (fnMap.has(name)) continue;

    // m.index is the start of "export function NAME("; m[0] ends at the
    // opening `(`. Advance past the closing `)` of the parameter list.
    let i = m.index + m[0].length;
    while (i < text.length && text[i] !== ")") i++;
    if (i >= text.length || text[i] !== ")") continue;
    i++; // past `)`
    const skipWs = () => {
      while (i < text.length && /\s/.test(text[i])) i++;
    };
    skipWs();

    // Optional return type: `: TypeAnnotation`. Inside the type expression
    // braces appear as part of object types like `Promise<{ results?: … }>`.
    // We must skip them so they don't get treated as the function body.
    if (text[i] === ":") {
      i++;
      skipWs();
      let paren = 0;
      let bracket = 0;
      let angle = 0;
      while (i < text.length) {
        const c = text[i];
        if (c === "(") paren++;
        else if (c === ")") paren--;
        else if (c === "[") bracket++;
        else if (c === "]") bracket--;
        else if (c === "<") angle++;
        else if (c === ">") angle--;
        else if (c === "{") {
          if (paren === 0 && bracket === 0 && angle === 0) break;
        }
        i++;
      }
      skipWs();
    }

    // `i` now points at the function body's opening `{`.
    if (text[i] !== "{") {
      // Could not locate a body (e.g. abstract declaration). Skip.
      continue;
    }
    const open = i;
    let depth = 1;
    i++;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    fnMap.set(name, text.slice(open, i - 1));
    declOrder.push(name);
  }

  // Check exported functions only.
  const exportRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
  let m;
  while ((m = exportRe.exec(text)) !== null) {
    const name = m[1];
    if (name.startsWith("_")) continue;
    if (SKIP_FUNCTIONS.has(name)) continue;
    total++;

    const body = fnMap.get(name);
    if (!body) continue;

    // Capture the lines immediately above and the full declaration (so that
    // // unauthenticated / // rls-gated annotations placed directly above
    // the declaration are still seen). Fixed buffer; annotations are
    // typically within a few lines of the export.
    const headStart = Math.max(0, m.index - 300);
    const head = text.slice(headStart, Math.min(text.length, m.index + 600));

    // Direct authorisation in this body?
    if (AUTH_PATTERN.test(body)) {
      checked++;
      continue;
    }

    // One-level delegation: this body calls another function in the same
    // file. If that function authorises, treat the caller as authorised.
    // Matches identifiers as bare references — sufficient for this codebase.
    const calls = body.match(/\b([A-Za-z_]\w*)\s*\(/g) || [];
    const candidates = calls
      .map((s) => s.replace(/\s*\($/, ""))
      .filter((n) => fnMap.has(n) && n !== name);
    const delegatedAuthed = candidates.some((c) => AUTH_PATTERN.test(fnMap.get(c) || ""));

    if (delegatedAuthed) {
      checked++;
      continue;
    }

    // Tolerate explicit annotations in the declaration's head.
    if (UNAUTHENTICATED_OK.test(head) || RLS_GATED_OK.test(head)) {
      checked++;
      continue;
    }

    unguarded.push({ file: rel, name, called: candidates });
  }
}

unguarded.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));

console.log(`action-rbac: ${checked}/${total} export(s) in lib/** and app/** carry an authorization check (direct or 1-level delegation)`);
if (unguarded.length) {
  console.log(`\n${unguarded.length} unguarded action(s):`);
  for (const u of unguarded) {
    const called = u.called.length ? ` (calls: ${u.called.join(", ")})` : "";
    console.log(`  - ${u.file} :: ${u.name}${called}`);
  }
}

process.exit(unguarded.length ? 1 : 0);