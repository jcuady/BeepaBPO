import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const dir = "e2e-evidence/landing-space";
mkdirSync(dir, { recursive: true });

// Was two hardcoded `http://localhost:3000` literals. The app is served on 3100
// (`next start -p 3100`), so this script screenshotted a connection-refused page
// and wrote it to `e2e-evidence/` as if it were the landing page.
const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3100";

const browser = await chromium.launch({ headless: true });

async function prep(page, sel) {
  await page.locator(`${sel} .reveal`).evaluateAll((els) => {
    for (const el of els) el.classList.add("is-visible");
  });
  await page.locator(sel).scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
}

function metrics(page, sel) {
  return page.locator(sel).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const kids = [...el.querySelectorAll(":scope > .mx-auto > .grid > *")];
    return {
      w: Math.round(box.width),
      childCount: kids.length,
      childLefts: kids.map((k) => Math.round(k.getBoundingClientRect().left - box.left)),
      childWidths: kids.map((k) => Math.round(k.getBoundingClientRect().width)),
    };
  });
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 980 } });
await desktop.goto(`${BASE}/`, { waitUntil: "networkidle" });

const shots = [
  ["#faq", "faq-1440.png"],
  ["#get-started", "final-1440.png"],
  ["#people-process-progress", "proof-1440.png"],
  ["#how-we-work", "manpower-1440.png"],
];
const layout = {};
for (const [sel, file] of shots) {
  await prep(desktop, sel);
  await desktop.locator(sel).screenshot({ path: `${dir}/${file}` });
  layout[sel] = await metrics(desktop, sel);
}

const h2Lines = await desktop.locator("#final-cta-heading").evaluate((el) => {
  const cs = getComputedStyle(el);
  return el.getBoundingClientRect().height / parseFloat(cs.lineHeight);
});
const dts = await desktop.locator("#faq dt").count();
await desktop.close();

const mobile = await browser.newPage({ viewport: { width: 375, height: 900 } });
await mobile.goto(`${BASE}/#faq`, { waitUntil: "networkidle" });
await prep(mobile, "#faq");
await mobile.locator("#faq").screenshot({ path: `${dir}/faq-375.png` });
await prep(mobile, "#get-started");
await mobile.locator("#get-started").screenshot({ path: `${dir}/final-375.png` });
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth <= window.innerWidth + 1,
);
await mobile.close();

await browser.close();
console.log(JSON.stringify({ layout, h2Lines, dts, overflow }, null, 2));
