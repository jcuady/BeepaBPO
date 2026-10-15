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
import { join, relative, resolve } from "node:path";

const ROOTS_DEFAULT = ["components", "app"];

// `--dir=<path>` scans somewhere else. Exists so a test can feed this script a
// fixture: a check that can only ever see the real components/ can never be
// proved to fire, and an unfireable check is indistinguishable from a passing one.
const dirArg = process.argv.slice(2).find((a) => a.startsWith("--dir="));
const ROOTS = dirArg ? [resolve(dirArg.slice("--dir=".length))] : ROOTS_DEFAULT;
const SCANNING_FIXTURE = Boolean(dirArg);

const displayPath = (f) => (SCANNING_FIXTURE ? f : relative(process.cwd(), f));
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

/**
 * The raw `defaults` / `defaultValues` object literal, so a caller can ask about
 * a field's VALUE rather than merely whether it has a key. `""` and a real
 * option value are both "keyed" — only one of them is safe on a select that
 * cannot render an empty option.
 */
function defaultsLiteral(src) {
  const decl =
    /\b(?:const|let)\s+defaults?\s*(?::[^=]+)?=\s*\{/.exec(src) ?? /\bdefaultValues\s*:\s*\{/.exec(src);
  if (!decl) return null;
  const start = decl.index + decl[0].length - 1;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Registered fields whose control is a <select> with no empty option.
 *
 * WHY THIS IS ITS OWN RULE
 * ------------------------
 * Adding `category: ""` to a form's defaults is correct in general — a field with
 * no default survives `reset()`. But `""` is only a *safe* default when the
 * control can actually display `""`.
 *
 * `create-ticket-form` had a category <select> with no placeholder option, so the
 * DOM showed the first real category while react-hook-form held `""`. The schema
 * requires `category` to be `min(1)`, so submitting produced "Select a category."
 * on a select that visibly had one chosen, and no ticket was ever created. It
 * surfaced as the tickets workflow exercise dropping from 33 assertions to a
 * FAIL on "a ticket exists for this run".
 *
 * The generalisable half: **a select with no empty option cannot hold `""`**, so
 * it must not be defaulted to `""`. `leave-request-form` and
 * `correction-request-form` both render `<option value="">…</option>` and are
 * correct; this form did not, and the other two saved it from the same bug.
 *
 * Narrow on purpose: only fields registered on a select, and only when the form
 * declares a default for that field. A heuristic that flags text inputs or
 * optional selects produces noise nobody reads.
 */
function selectsWithoutEmptyOption(src) {
  const out = [];
  // Match a NativeSelect or select element block, allowing for nested braces in
  // the props (register() spreads are the common case).
  const re = /<(NativeSelect|select)\b([\s\S]*?)<\/\1>/g;
  for (const m of src.matchAll(re)) {
    const [, tag, inner] = m;
    const reg = /register\(\s*["']([^"']+)["']/.exec(inner);
    if (!reg) continue;
    // An explicit placeholder is the whole point. Matched as `value=""` — two
    // quotes and the closing bracket. Written as `["']{2}["']` this demands
    // THREE quote characters, which no attribute ever has, so every select was
    // reported and the check flagged the whole codebase including the forms it
    // had just been written to bless.
    if (/<option\s+value\s*=\s*(?:""|'')\s*>/.test(inner)) continue;
    out.push({ field: reg[1], tag });
  }
  return out;
}

const files = ROOTS.flatMap((r) => tsxFiles(r));
if (!files.length) {
  console.error(`ABORT: no .tsx files found under ${ROOTS.join(", ")}.`);
  process.exit(2);
}

const findings = [];
const emptyOptionFindings = [];
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
      file: displayPath(file),
      registered: [...fields].sort(),
      defaults: keys ? [...keys].sort() : null,
      missing: missing.sort(),
    });
  }

  // Rule 2, independent of whether every field is defaulted: a select that
  // cannot display "" must not be explicitly defaulted to "".
  const lit = defaultsLiteral(src) ?? "";
  for (const sel of selectsWithoutEmptyOption(src)) {
    // Built from a normal string, not a template literal: a backtick inside one
    // needs escaping that is easy to get wrong, and an empty template literal is
    // not a realistic default here.
    const explicitlyEmpty = new RegExp("\\b" + sel.field + "\\s*:\\s*(?:\"|'){2}").test(lit);
    if (!explicitlyEmpty) continue;
    emptyOptionFindings.push({ file: displayPath(file), field: sel.field, tag: sel.tag });
  }
}

console.log(`FORM RESET DEFAULTS AUDIT`);
console.log("─".repeat(60));
console.log(`${scanned} form(s) using useForm, ${withReset} of which call reset()`);
console.log(`${emptyOptionFindings.length} defaulted to "" on a select that cannot display ""\n`);

for (const f of emptyOptionFindings) {
  console.log(`  ${f.file}`);
  console.log(`    field "${f.field}" is defaulted to "" but its <${f.tag}> has no empty option.`);
  console.log(`    The control shows a real value while the form model holds "", so validation`);
  console.log(`    disagrees with what is on screen and the submit never succeeds.`);
  console.log(`    Either render <option value="">Select…</option>, or default the field to a`);
  console.log(`    real option value.\n`);
}

if (!findings.length && !emptyOptionFindings.length) {
  console.log("VERDICT: every form that resets defaults all the fields it registers,");
  console.log("and no field is defaulted to a value its control cannot display.");
  process.exit(0);
}

if (findings.length) {
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
}

process.exit(findings.length || emptyOptionFindings.length ? 1 : 0);