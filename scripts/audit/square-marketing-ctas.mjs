// One-off: square the marketing CTAs and chips.
//
// WHY A SCRIPT
// The same pill CTA is copy-pasted into seven section files, so the shape
// appears sixteen times. Hand-editing sixteen near-identical class strings is
// exactly how one gets missed and then drifts back.
//
// WHAT IS DELIBERATELY LEFT CIRCULAR
// A `rounded-full` is not automatically a pill. Four uses are correct as they
// are and would be damaged by a blanket replace:
//   - the decorative radial orbs (`[mask-image:radial-gradient(...)]`) — they
//     are literally circular gradient falloffs
//   - the hero's 40px portrait — a photograph of a person
//   - `size-1.5 ... rounded-full` — a bullet dot the size of a dot
//   - the contact form's progress-bar track and its segments, where a rounded
//     track is the point
//
// So this replaces exact class strings, not the token. Every replacement below
// is a full class substring that only occurs in the pill-shaped case.
//
// Run: node scripts/audit/square-marketing-ctas.mjs [--dry-run]

import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");

const REPLACEMENTS = [
  // Filled brand CTA (7 files)
  ["rounded-full bg-green-strong px-6", "rounded-none bg-green-strong px-6"],
  // Outlined secondary CTA (7 files)
  [
    "rounded-full border border-navy/20 bg-white px-6",
    "rounded-none border border-navy/20 bg-white px-6",
  ],
  // page-hero fills, which size differently
  ["gap-2 rounded-full bg-green-strong text-white", "gap-2 rounded-none bg-green-strong text-white"],
  ["min-h-11 rounded-full border-navy/20", "min-h-11 rounded-none border-navy/20"],
  // Arrow discs inside CTAs
  [
    "size-7 items-center justify-center rounded-full bg-white/15",
    "size-7 items-center justify-center rounded-none bg-white/15",
  ],
  [
    "size-6 items-center justify-center rounded-full bg-white/15",
    "size-6 items-center justify-center rounded-none bg-white/15",
  ],
  // Careers band badge chips
  ["gap-2 rounded-full bg-soft-green/55", "gap-2 rounded-none bg-soft-green/55"],
  ["gap-2 rounded-full bg-mist", "gap-2 rounded-none bg-mist"],
  [
    "size-6 items-center justify-center rounded-full bg-white",
    "size-6 items-center justify-center rounded-none bg-white",
  ],
  // Floating status chip on the final CTA
  [
    "gap-2 rounded-full bg-white py-1.5 pr-3 pl-2.5",
    "gap-2 rounded-none bg-white py-1.5 pr-3 pl-2.5",
  ],
  // Icon discs
  [
    "size-5 items-center justify-center rounded-full bg-soft-green text-green-strong",
    "size-5 items-center justify-center rounded-none bg-soft-green text-green-strong",
  ],
  [
    "size-11 items-center justify-center rounded-full bg-soft-green text-green",
    "size-11 items-center justify-center rounded-none bg-soft-green text-green",
  ],
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const files = [
  ...walk(join(ROOT, "components/marketing")),
  ...walk(join(ROOT, "components/layout")),
];

let total = 0;
let filesChanged = 0;

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const before = readFileSync(file, "utf8");
  let next = before;
  let hits = 0;

  for (const [from, to] of REPLACEMENTS) {
    const parts = next.split(from);
    const n = parts.length - 1;
    if (n) {
      hits += n;
      next = parts.join(to);
    }
  }

  if (next === before) continue;
  total += hits;
  filesChanged++;
  console.log(`${rel}: ${hits}`);
  if (!DRY) writeFileSync(file, next);
}

console.log(`\n${DRY ? "would change" : "changed"} ${filesChanged} file(s), ${total} class string(s)`);