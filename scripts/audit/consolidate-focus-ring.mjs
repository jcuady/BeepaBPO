// Consolidate focusRing constant across marketing components.
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "components/marketing/careers-band.tsx",
  "components/marketing/faq-section.tsx",
  "components/marketing/final-cta.tsx",
  "components/marketing/manpower-model-section.tsx",
  "components/marketing/proof-strip.tsx",
  "components/marketing/services-section.tsx",
  "components/marketing/why-beepa-section.tsx",
];

const CONST_RE = /const focusRing =\s*\r?\n\s*"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong\/45 focus-visible:ring-offset-2";\r?\n/;
const IMPORT_LINE = 'import { focusRing } from "@/components/beepa/focus-ring";\n';

for (const f of files) {
  let txt = readFileSync(f, "utf8");
  if (!CONST_RE.test(txt)) {
    console.log(`  [skip] no const focusRing in ${f}`);
    continue;
  }
  // Remove the const declaration block (incl. trailing newline).
  txt = txt.replace(CONST_RE, "");
  // Add the import after the last existing import line, or at the top.
  if (!txt.includes('from "@/components/beepa/focus-ring"')) {
    const lines = txt.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, IMPORT_LINE.trimEnd());
    } else {
      lines.unshift(IMPORT_LINE.trimEnd());
    }
    txt = lines.join("\n");
  }
  writeFileSync(f, txt);
  console.log(`  [OK]   ${f}`);
}