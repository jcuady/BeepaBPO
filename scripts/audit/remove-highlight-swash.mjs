// Remove the lime highlight swash from marketing headings.
//
// The swash is a hand-highlighter effect that never appears in the new design:
// the reference emphasises with COLOUR ALONE (`h1 span { color: brand-green }`,
// `section h2 em { font-style: normal; color: brand-green }`). It appeared six
// times, identically, so it is removed by exact line match rather than by hand.
//
// NOT TOUCHED: proof-strip.tsx uses `bg-lime/20 ring-lime/40` for a pill badge,
// which is a different use of the same colour and is left alone. The pattern
// below matches the swash specifically — `h-[0.42em]` with the lime fill.

import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");

// Matches the whole swash element including its surrounding whitespace.
const SWASH =
  /\n\s*<span\s+aria-hidden\s+className="absolute inset-x-0 bottom-1 -z-10 h-\[0\.42em\] rounded-\[3px\] bg-lime\/45"\s*\/>/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

let total = 0;
let filesChanged = 0;

for (const file of walk(join(ROOT, "components/marketing"))) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const before = readFileSync(file, "utf8");
  const matches = before.match(SWASH);
  if (!matches) continue;

  const after = before.replace(SWASH, "");
  total += matches.length;
  filesChanged++;
  console.log(`${rel}: ${matches.length}`);
  if (!DRY) writeFileSync(file, after);
}

console.log(`\n${DRY ? "would remove" : "removed"} ${total} swash(es) in ${filesChanged} file(s)`);