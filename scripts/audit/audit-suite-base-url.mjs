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
// THE BUG IN THE FIRST VERSION OF THIS GATE
// -----------------------------------------
// It reported "41 browser-driving scripts agree" and was wrong. Two holes, both
// silent:
//
//   1. It only considered scripts importing Playwright. `smoke-cron.mjs` uses
//      plain `fetch`, so it was never examined — despite the file's own comment
//      saying the rule applies to "any script that drives a browser **or fetches
//      a page**". The gate enforced half of its stated rule.
//
//   2. It only recognised the literal shape `const BASE = ...`. `smoke-cron.mjs`
//      writes `const base = ...` — lowercase, parenthesised. Even without hole 1
//      it would have been skipped.
//
// Together they hid a real instance of the exact defect this file exists for:
//
//   const base = (process.env.SMOKE_BASE_URL || "http://localhost:3000")
//
// Wrong env var AND wrong port. Found by reading a file the gate claimed to
// cover, not by the gate. A coverage check that is blind to a whole category of
// file is worse than no check: it reports agreement it never established.
//
// THE RULE
// --------
// Any script that performs HTTP must:
//   1. read `QA_BASE_URL` first (the repo convention), if it reads any base-URL
//      override at all, and
//   2. never default to port 3000.
//
// Exit 0 when every script agrees, 1 on a drifted one. A suite whose scripts
// point at different ports is not a suite.
//
// This is deliberately a lint over sibling files, not a runtime probe: it has to
// be cheap enough to run on every change, and the failure it catches is visible
// in the source anyway.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// `--dir=<path>` scans a different scripts root. Used by
// `tests/audit-gate-integrity.test.ts` to plant known-bad input and assert this
// gate goes red.
//
// Without it, proving the gate can fire means dropping a deliberately drifted
// script into the real `scripts/` tree — the same directory the suite runs from,
// and the one a reader trusts to be clean.
const dirArg = process.argv.slice(2).find((a) => a.startsWith("--dir="));
const ROOTS = dirArg ? [resolve(dirArg.slice("--dir=".length))] : ["scripts"];
const SKIP = /node_modules|\.next|\.git/;
const EXPECTED_DEFAULT = "http://localhost:3100";
const WRONG_PORT = "localhost:3000";

/** Scripts that perform HTTP: Playwright, fetch, or an exec'd curl. */
const DOES_HTTP =
  /\bfetch\s*\(|["'`]\/?curl\b|execFileSync\(\s*["'`]curl|from\s+["'](?:@playwright\/test|playwright)["']|chromium\.launch|\.goto\s*\(/;

/**
 * Env vars that mean "the origin to drive a browser against".
 *
 * Deliberately narrow. `NEXT_PUBLIC_SITE_URL` is a build-time application
 * constant, not an operator override; flagging a script for reading it would be
 * the confident-nonsense class of finding that gets a gate switched off.
 */
const BASE_URL_ENV = /^(?:(?:QA|SMOKE|TEST|AUDIT)_)?BASE_URL$|^(?:APP|ORIGIN|SITE_BASE)_?URL$/;

/**
 * Strip comments WITHOUT destroying string literals.
 *
 * This cannot be the regex version used by four sibling gates
 * (`/\/\*[\s\S]*?\*\//g` then split lines). Those delete from `//` to end of
 * line, which turns `"http://localhost:3000"` into `"http:` — deleting the
 * exact literal under test. Harmless for a gate scanning for `<ListPager`;
 * fatal for this one. String/template aware, preserves line numbers.
 */
function stripComments(src) {
  let out = "";
  let mode = "code"; // code | line | block | sq | dq | tpl
  let tplDepth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (mode === "code") {
      if (c === "/" && n === "/") { mode = "line"; out += "  "; i++; continue; }
      if (c === "/" && n === "*") { mode = "block"; out += "  "; i++; continue; }
      if (c === "'") mode = "sq";
      else if (c === '"') mode = "dq";
      else if (c === "`") { mode = "tpl"; tplDepth = 0; }
      out += c; continue;
    }
    if (mode === "line") { if (c === "\n") { mode = "code"; out += c; } else out += " "; continue; }
    if (mode === "block") {
      if (c === "*" && n === "/") { mode = "code"; out += "  "; i++; continue; }
      out += c === "\n" ? "\n" : " "; continue;
    }
    // inside a string: only a matching, unescaped quote ends it
    if (c === "\\") { out += c + (n ?? ""); i++; continue; }
    if (mode === "sq" && c === "'") mode = "code";
    else if (mode === "dq" && c === '"') mode = "code";
    else if (mode === "tpl") {
      if (c === "$" && n === "{") { tplDepth++; out += "${"; i++; continue; }
      if (c === "}" && tplDepth > 0) { tplDepth--; out += c; continue; }
      if (c === "`" && tplDepth === 0) mode = "code";
    }
    out += c;
  }
  return out;
}

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
let httpScripts = 0;

for (const file of files) {
  const src = stripComments(readFileSync(file, "utf8"));
  if (!DOES_HTTP.test(src)) continue;
  httpScripts++;

  const urlLiterals = [...src.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)].map((m) => m[1]);
  const baseEnvVars = [
    ...new Set(
      [...src.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)]
        .map((m) => m[1])
        .filter((n) => BASE_URL_ENV.test(n)),
    ),
  ];

  // Performs HTTP but has no origin to aim at: nothing to drift.
  if (!urlLiterals.length && !baseEnvVars.length) continue;

  checked++;
  const problems = [];

  // Port drift, wherever the literal lives — not only in a `const BASE`.
  // Deduplicated: a script with two drifted literals is one file to fix, and
  // printing the same sentence twice reads as two problems.
  const wrongPorts = new Set(urlLiterals.filter((l) => l.includes(WRONG_PORT)));
  if (wrongPorts.size) {
    problems.push(
      `references ${WRONG_PORT} (${wrongPorts.size} literal${wrongPorts.size > 1 ? "s" : ""}), but the app is served on 3100 (\`next start -p 3100\`). Expected ${EXPECTED_DEFAULT}.`,
    );
  }

  if (baseEnvVars.length && !baseEnvVars.includes("QA_BASE_URL")) {
    problems.push(
      `reads ${baseEnvVars.join(", ")} for its origin but not QA_BASE_URL. Every other HTTP audit script does; ` +
        `an operator who sets only QA_BASE_URL — the documented convention — silently gets this script's default instead.`,
    );
  }

  if (problems.length) findings.push({ file: relative(process.cwd(), file), problems });
}

console.log("AUDIT SUITE BASE-URL CONSISTENCY");
console.log("─".repeat(60));
console.log(`${httpScripts} script(s) under ${ROOTS.join(", ")} perform HTTP`);
console.log(`${checked} of those resolve an origin from a URL literal or an env override`);
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