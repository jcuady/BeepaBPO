// Find forms whose `reset()` cannot clear every field they register.
//
// WHY THIS EXISTS
// ---------------
// `leave-request-form.tsx` had `const defaults = { reason: "" }` and a Reset
// button wired to `form.reset({ ...defaults })`. react-hook-form only writes into
// an UNCONTROLLED input when it has a value to write, and every field in that
// form is registered uncontrolled — so `reason` cleared and `start_date`,
// `end_date` and `leave_type_id` silently kept the user's typing. A user who
// clicked "I have cleared this form" could then submit the dates they believed
// they had removed.
//
// The same `reset` also runs after a successful submit, so a second leave
// request could inherit the first one's dates.
//
// That is 28 forms' worth of the same mistake waiting to happen, and reading
// each one is exactly the kind of check that gets skipped. So this is a check.
//
// THE RULE
// --------
// A form that calls `reset()` must give EVERY field it registers an explicit
// default. A missing default is not a style nit: it is a field that survives a
// reset the user believes cleared it.
//
// Registering a field with `setValue` only, or reading it in `watch`, does not
// change this — the condition is narrow on purpose, so a finding is a real bug
// and not a stylistic disagreement.
//
// Exit 0 when clean, 1 when any form is found, 2 when nothing could be scanned
// (an audit that cannot see the files must not report success).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["components", "app"];
const SKIP = /node_modules|\.next|BeepaBPO new landing design/;

/** Every .tsx under a root, recursively. */
function tsxFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP.test(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(".tsx")) out.push(full);
    }
  };
  walk(root);
  return out;
}

/**
 * Field names registered uncontrolled, via `form.register("x")` or the
 * shorthand `{...register("x")}`.
 */
function registeredFields(src) {
  const names = new Set();
  for (const m of src.matchAll(/\bregister\(\s*["'`]([^"'`]+)["'`]/g)) names.add(m[1]);
  return names;
}

/**
 * Top-level keys of the `defaults` / `defaultValues` object literal.
 *
 * Parses only the first-level braces, so a nested object does not leak its inner
 * keys into the field list — a false field name would produce a finding that is
 * not a bug.
 */
function defaultKeys(src) {
  const keys = new Set();
  const decl = /\b(?:const|let)\s+defaults?\s*(?::[^=]+)?=\s*\{/.exec(src)
    ?? /\bdefaultValues\s*:\s*\{/.exec(src);
  if (!decl) return null; // null = no defaults at all

  const start = decl.index + decl[0].length - 1;
  let depth = 0;
  let body = "";
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { body = src.slice(start + 1, i); break; }
    }
    if (depth >= 1) body += ch;
  }

  // Top-level keys only: a key is one at depth 0 within the body.
  let d = 0;
  const parts = [];
  let cur = "";
  for (const ch of body) {
    if (ch === "{" || ch === "[" || ch === "(") d++;
    else if (ch === "}" || ch === "]" || ch === ")") d--;
    if (d === 0 && ch === ",") { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  for (const part of parts) {
    const m = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(part);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const files = ROOTS.flatMap((r) => tsxFiles(r));
if (!files.length) {
  console.error(`ABORT: no .tsx files found under ${ROOTS.join(", ")}.`);
  process.exit(2);
}

const findings = [];
let scanned = 0;
let withReset = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!/\buseForm\b/.test(src)) continue;
  scanned++;

  // Only forms that can actually exhibit the bug reset themselves.
  const resets = /\bform\.reset\s*\(|\breset\s*\(\s*\{\s*\.\.\.defaults|\breset\s*\(\s*defaults/.test(src);
  if (!resets) continue;
  withReset++;

  const fields = registeredFields(src);
  if (!fields.size) continue;

  const keys = defaultKeys(src);
  const missing = keys ? [...fields].filter((f) => !keys.has(f)) : [...fields];

  if (missing.length) {
    findings.push({
      file: relative(process.cwd(), file),
      registered: [...fields].sort(),
      defaults: keys ? [...keys].sort() : null,
      missing: missing.sort(),
    });
  }
}

console.log(`FORM RESET DEFAULTS AUDIT`);
console.log("─".repeat(60));
console.log(`${scanned} form(s) using useForm, ${withReset} of which call reset()\n`);

if (!findings.length) {
  console.log("VERDICT: every form that resets defaults all the fields it registers.");
  console.log("A field with no default survives reset() and keeps the user's typing.");
  process.exit(0);
}

console.log(`VERDICT: ${findings.length} form(s) reset without defaulting every registered field.\n`);
for (const f of findings) {
  console.log(`  ${f.file}`);
  console.log(`    registers: ${f.registered.join(", ")}`);
  console.log(`    defaults:  ${f.defaults ? f.defaults.join(", ") : "(none declared)"}`);
  console.log(`    SURVIVES RESET: ${f.missing.join(", ")}`);
  console.log("");
}
console.log(
  "Fix: add an explicit default for every registered field, so reset() has a\n" +
    "value to write into the uncontrolled input. A missing default is not a style\n" +
    "nit -- it is a field that outlives a reset the user believes cleared it.",
);
process.exit(1);