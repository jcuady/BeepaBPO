// Report the exact code points of every non-ASCII character in a file, and optionally
// strip a leading BOM.
//
// Needed because PowerShell's console lies about encoding in both directions -- the
// encoding-integrity test's own comment says so. Deciding whether a file is corrupt from
// what the terminal printed produced the wrong answer here, so this reads bytes with Node
// and prints code points, which cannot be re-mangled on the way out.
//
// Usage: node scripts/audit/qa-show-nonascii.mjs <file> [...files] [--strip-bom]
//
//   --strip-bom  removes a leading U+FEFF in place. A BOM is not caught by the encoding
//                test, so nothing else in this repo will tell you it is there; it is
//                offered here because this is already the tool that reports it.

import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const stripBom = argv.includes("--strip-bom");
const files = argv.filter((a) => !a.startsWith("--"));

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let text = original;
  if (stripBom && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    writeFileSync(file, text, "utf8");
    console.log(`${file}: BOM stripped`);
  }

  console.log(`\n${file}`);
  if (text.charCodeAt(0) === 0xfeff) console.log("  BOM at byte 0");

  const seen = new Map();
  text.split(/\r?\n/).forEach((line, i) => {
    for (const ch of line) {
      const cp = ch.codePointAt(0);
      if (cp < 128) continue;
      const key = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
      if (!seen.has(key)) seen.set(key, { ch, lines: [] });
      if (!seen.get(key).lines.includes(i + 1)) seen.get(key).lines.push(i + 1);
    }
  });

  if (!seen.size) { console.log("  (pure ASCII)"); continue; }
  // Named with escape sequences rather than literal characters. Writing the characters
  // themselves puts curly quotes, a euro sign and an invisible no-break space into a file
  // whose entire job is inspecting unusual characters -- and the no-break space is
  // invisible enough that nobody would notice it arriving. A diagnostic that cannot be read
  // cleanly is a diagnostic that gets ignored.
  const NAMES = {
    "—": "EM DASH",
    "–": "EN DASH",
    "‘": "LEFT SINGLE QUOTE",
    "’": "RIGHT SINGLE QUOTE",
    "“": "LEFT DOUBLE QUOTE",
    "”": "RIGHT DOUBLE QUOTE",
    "…": "HORIZONTAL ELLIPSIS",
    "•": "BULLET",
    "→": "RIGHTWARDS ARROW",
    "├": "BOX DRAWINGS LIGHT VERTICAL AND RIGHT",
    "€": "EURO SIGN (mojibake, U+0080 decoded)",
    "â": "LATIN SMALL A WITH CIRCUMFLEX (mojibake leader)",
    " ": "NO-BREAK SPACE",
    "﻿": "ZERO WIDTH NO-BREAK SPACE / BOM",
  };
  // The real mojibake signature is U+00E2 (a) IMMEDIATELY followed by U+20AC or one of the
  // curly quotes/ellipsis -- the C1 control bytes 0x80/0x91/0x92/0x93/0x94 decoded as cp1252.
// Flagging the curly quotes on their own is wrong: they are legitimate in prose, and the
  // encoding-integrity test treats them as legitimate too (its LEGITIMATE set). Only the
  // bytes that cannot legitimately appear are called out here.
  const SUSPICIOUS = ["€", " "];
  for (const [key, { ch, lines }] of seen) {
    const bad = SUSPICIOUS.includes(ch) ? "  <-- MOJIBAKE (decoded C1 byte)" : "";
    console.log(`  ${key} ${NAMES[ch] ?? "unclassified"}${bad}  lines: ${lines.slice(0, 12).join(", ")}`);
  }
}