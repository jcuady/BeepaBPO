// Repair UTF-8 mojibake: bytes that were decoded as cp1252 and stored as UTF-8.
//
// WHY THIS EXISTS
// When this file was first written it contained real em dashes and curly quotes in its
// lookup table, and the writer double-encoded them into U+00E2 U+20AC U+201D. The tool
// meant to repair mojibake was itself the mojibake, and `tests/encoding-integrity.test.ts`
// caught it on the next run.
//
// So this file is deliberately PURE ASCII. Every non-ASCII character it needs is written as
// a \\u escape, because a lookup table of exotic characters is exactly the content most
// likely to be mangled in transit -- and a mangled lookup table does not fail loudly, it
// fails silently by never matching.
//
// A second, less obvious lesson from the same incident. The file being repaired was
// ALREADY CLEAN. PowerShell's console rendered a UTF-8 em dash as the three-character
// mojibake sequence, which is indistinguishable on screen from real corruption, and that
// display artefact was what prompted the whole repair. The test is right and the terminal
// is wrong. Before repairing an encoding fault, run the test that detects it -- do not read
// the defect off the console output.
//
// Usage: node scripts/audit/qa-repair-mojibake.mjs <file> [...files] [--check]
//
//   --check  report only, change nothing, exit 1 if anything would be repaired

import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");
const files = argv.filter((a) => !a.startsWith("--"));

const EM = "\u2014"; // em dash
const EN = "\u2013"; // en dash
const RSQ = "\u2019"; // right single quote
const LDQ = "\u201c"; // left double quote
const RDQ = "\u201d"; // right double quote
const ELL = "\u2026"; // horizontal ellipsis
const CIRC = "\u00e2"; // a-circumflex: the decoded lead byte of a UTF-8 3-byte sequence
const EURO = "\u20ac"; // euro: decoded 0x80
const NBSP = "\u00a0"; // no-break space: decoded 0xA0

// Each entry is the three characters a UTF-8 sequence degrades into when read as cp1252.
// Keyed on the escaped form, so this table cannot be corrupted by the act of writing it.
const REPAIRS = new Map([
  [`${CIRC}${EURO}${RDQ}`, EM],
  [`${CIRC}${EURO}${EN}`, EN],
  [`${CIRC}${EURO}${RSQ}`, RSQ],
  [`${CIRC}${EURO}${LDQ}`, LDQ],
  [`${CIRC}${EURO}${ELL}`, ELL],
  [`${CIRC}${EURO}${NBSP}`, " "],
]);

let total = 0;
const affected = [];

for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before;
  let count = 0;

  for (const [bad, good] of REPAIRS) {
    const parts = after.split(bad);
    if (parts.length > 1) {
      count += parts.length - 1;
      after = parts.join(good);
    }
  }

  // A leading BOM is the same class of accident and nothing in this repo wants one.
  if (after.charCodeAt(0) === 0xfeff) {
    after = after.slice(1);
    count += 1;
  }

  if (count > 0) {
    total += count;
    affected.push(`${file}: ${count} replacement(s)`);
    if (!checkOnly) writeFileSync(file, after, "utf8");
  }
}

console.log(affected.length ? affected.join("\n") : "no mojibake found");
if (total) console.log(`\n${total} replacement(s)${checkOnly ? " (check only, nothing written)" : ""}`);

process.exitCode = checkOnly && total > 0 ? 1 : 0;