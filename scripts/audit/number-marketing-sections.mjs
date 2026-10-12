// Number the narrative sections, in PAGE ORDER.
//
// The number is only useful if it matches the order the reader scrolls through:
// a section marked "03" that appears before "02" turns a navigation aid into a
// lie. The mapping below is taken from the rendered page's section order, not
// from the order the components happen to be imported in.
//
// NOT NUMBERED, deliberately:
//   - trusted-by-section — a horizontal marquee above the first real section,
//     not a section in the sequence
//   - final-cta — a closing call to action; numbering it "07" would imply more
//     content follows, which is the opposite of what a closing CTA means

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");

// file -> [existing JSX, index]
const MAP = {
  "services-section.tsx": ["<EyebrowPill>What we staff</EyebrowPill>", "01"],
  "why-beepa-section.tsx": ["<EyebrowPill>How we split the work</EyebrowPill>", "02"],
  "proof-strip.tsx": ["<EyebrowPill>The Beepa operating model</EyebrowPill>", "03"],
  "careers-band.tsx": ["<EyebrowPill>Open roles at Beepa</EyebrowPill>", "04"],
  "manpower-model-section.tsx": ["<EyebrowPill>The three-step model</EyebrowPill>", "05"],
  "faq-section.tsx": ["<EyebrowPill>Frequently asked</EyebrowPill>", "06"],
};

for (const [name, [from, index]] of Object.entries(MAP)) {
  const file = join(ROOT, "components/marketing", name);
  const before = readFileSync(file, "utf8");
  if (!before.includes(from)) {
    console.log(`SKIP  ${name} — call site not found verbatim, left alone`);
    continue;
  }
  const after = before.replace(from, `<EyebrowPill index="${index}">`);
  console.log(`${name}: ${index}`);
  if (!DRY) writeFileSync(file, after);
}

console.log(`\n${DRY ? "would number" : "numbered"} ${Object.keys(MAP).length} section(s)`);