// Add motion-reduce variants to scale/translate animations on the marketing
// site so prefers-reduced-motion users don't get micro-translation feedback.
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "components/marketing/careers-band.tsx",
  "components/marketing/faq-section.tsx",
  "components/marketing/final-cta.tsx",
  "components/marketing/hero-section.tsx",
  "components/marketing/manpower-model-section.tsx",
  "components/marketing/proof-strip.tsx",
  "components/marketing/services-section.tsx",
  "components/marketing/why-beepa-section.tsx",
  "components/marketing/page-hero.tsx",
  "components/layout/site-header.tsx",
  "components/layout/site-footer.tsx",
];

let total = 0;
for (const f of files) {
  let txt = readFileSync(f, "utf8");
  const before = txt;
  // Add motion-reduce: to active:scale-[0.97] and active:translate-y-px
  txt = txt.replace(/\bactive:scale-\[0\.97\]/g, "active:scale-[0.97] motion-reduce:active:scale-100");
  txt = txt.replace(/\bactive:translate-y-px\b/g, "active:translate-y-px motion-reduce:translate-y-0");
  // Group-hover translate-x-0.5 -> pair with motion-reduce
  txt = txt.replace(/\bgroup-hover:translate-x-0\.5/g, "group-hover:translate-x-0.5 motion-reduce:translate-x-0");
  // Bare translate-x-0.5 inside transition-transform arrows
  txt = txt.replace(/(?<!group-hover:)translate-x-0\.5(?![-\w])/g, (m, _o, s) => s.startsWith(" ") ? "translate-x-0.5 motion-reduce:translate-x-0" : m);
  if (txt !== before) {
    writeFileSync(f, txt);
    total++;
    console.log(`  [OK]   ${f}`);
  } else {
    console.log(`  [skip] ${f}`);
  }
}
console.log(`\nUpdated ${total} files.`);
