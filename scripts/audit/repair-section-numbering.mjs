// Repair: number-marketing-sections.mjs replaced the ENTIRE element
//   <EyebrowPill>What we staff</EyebrowPill>
// with
//   <EyebrowPill index="01">
// which removed the children and the closing tag. TypeScript caught it on the
// next build (TS17008) rather than shipping a broken page.
//
// The fix restores the label and the closing tag. This is the whole reason the
// script was run as --dry-run first, and the whole reason the build gate runs
// after every codemod.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const MAP = {
  "services-section.tsx": ["01", "What we staff"],
  "why-beepa-section.tsx": ["02", "How we split the work"],
  "proof-strip.tsx": ["03", "The Beepa operating model"],
  "careers-band.tsx": ["04", "Open roles at Beepa"],
  "manpower-model-section.tsx": ["05", "The three-step model"],
  "faq-section.tsx": ["06", "Frequently asked"],
};

for (const [name, [index, label]] of Object.entries(MAP)) {
  const file = join(ROOT, "components/marketing", name);
  const before = readFileSync(file, "utf8");
  const broken = `<EyebrowPill index="${index}">`;
  if (!before.includes(broken)) {
    console.log(`SKIP  ${name} — nothing to repair`);
    continue;
  }
  const fixed = before.replace(broken, `${broken}${label}</EyebrowPill>`);
  writeFileSync(file, fixed);
  console.log(`${name}: restored "${label}"`);
}