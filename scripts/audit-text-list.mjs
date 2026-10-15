/** List remaining sub-16px body copy per route at 375px. */
import { chromium } from "@playwright/test";

const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? process.argv[2] ?? "http://localhost:3100";
const ROUTES = process.argv.slice(3);
const browser = await chromium.launch();

for (const route of ROUTES) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  const rows = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("p, li, dd, blockquote, span")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const text = (el.textContent || "").trim();
      if (text.length < 25 || el.children.length > 0) continue;
      if (
        cs.textTransform === "uppercase" ||
        parseFloat(cs.letterSpacing) >= 0.08 ||
        cs.fontFamily.includes("mono")
      )
        continue;
      if (el.closest("nav, [data-marquee]")) continue;
      const size = parseFloat(cs.fontSize);
      if (size > 0 && size < 16) {
        out.push({
          size: Math.round(size * 10) / 10,
          text: text.slice(0, 54),
          cls: (el.className || "").toString().slice(0, 72),
        });
      }
    }
    return out;
  });

  if (rows.length) {
    console.log(`\n=== ${route} — ${rows.length} ===`);
    for (const r of rows) console.log(`  ${r.size}px  ${r.text}\n         ${r.cls}`);
  }
  await ctx.close();
}
await browser.close();