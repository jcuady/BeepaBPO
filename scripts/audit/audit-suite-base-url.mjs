// Stop the audit suite disagreeing with itself about where the app lives.
//
// WHY THIS EXISTS
// ---------------
// `audit-role-pages.mjs` and `audit-performance.mjs` read `BASE_URL` and defaulted
// to port **3000**, while the other 44 audit scripts read `QA_BASE_URL` and
// default to **3100** — the port `npx next start -p 3100` serves, which is what
// the docs tell an operator to run.
//
// The cost was not theoretical. Running `pnpm audit:role-pages` against a live
// server on 3100 produced:
//
//   0/13 nav-reachable role pages clean
//   13 page(s) a role can SEE but cannot USE
//
// All thirteen from ERR_CONNECTION_REFUSED. A gate that reports thirteen broken
// roles when every role is fine is worse than no gate, because the reader has no
// way to tell a connection error from a finding.
//
// THE RULE
// --------
// Any script that drives a browser against the app must:
//   1. read `QA_BASE_URL` first (the repo convention), and
//   2. default to port 3100, not 3000.
//
// Exit 0 when every script agrees, 1 on a drifted one. A suite whose scripts
// point at different ports is not a suite.
//
// This is deliberately a lint over sibling files, not a runtime probe: it has to
// be cheap enough to run on every change, and the failure it catches is visible
// in the source anyway.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["scripts"];
const SKIP = /node_modules|\.next|\.git/;
const EXPECTED_DEFAULT = "http://localhost:3100";

/** Scripts that open a browser or fetch a page are the ones that care. */
const DRIVES_BROWSER = /from "@playwright\/test"|from "playwright"/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.test(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".mjs") || entry.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => (existsSync(r) ? walk(r) : []));
if (!files.length) {
  console.error(`ABORT: no scripts found under ${ROOTS.join(", ")}.`);
  process.exit(2);
}

const findings = [];
let checked = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!DRIVES_BROWSER.test(src)) continue;

  // Only scripts that actually resolve a base URL from the environment.
  const decl = /const\s+BASE\s*=\s*([^;]+);/.exec(src);
  if (!decl) continue;
  // A hardcoded literal with no env override cannot drift, and is fine.
  if (!/process\.env/.test(decl[1])) continue;

  checked++;
  const expr = decl[1];
  const problems = [];

  if (!/QA_BASE_URL/.test(expr)) {
    problems.push(
      "does not read QA_BASE_URL first. Every other browser-driving script does; an " +
        "operator who sets only QA_BASE_URL — the documented convention — silently " +
        "gets this script's default instead.",
    );
  }
  if (/localhost:3000/.test(expr)) {
    problems.push(
      `defaults to port 3000, but the app is served on 3100 (\`next start -p 3100\`). ` +
        `Expected ${EXPECTED_DEFAULT}.`,
    );
  }

  if (problems.length) findings.push({ file: relative(process.cwd(), file), problems });
}

console.log("AUDIT SUITE BASE-URL CONSISTENCY");
console.log("─".repeat(60));
console.log(`${checked} browser-driving script(s) resolve a base URL from the environment`);
console.log(`convention: QA_BASE_URL first, default ${EXPECTED_DEFAULT}\n`);

if (!findings.length) {
  console.log("VERDICT: every audit script agrees where the app lives.");
  process.exit(0);
}

console.log(`VERDICT: ${findings.length} script(s) disagree with the suite.\n`);
for (const f of findings) {
  console.log(`  ${f.file}`);
  for (const p of f.problems) console.log(`    - ${p}`);
}
console.log(
  "\nA script pointed at the wrong port reports connection-refused as a product\n" +
    "finding. That is how thirteen healthy roles read as thirteen broken ones.",
);
process.exit(1);