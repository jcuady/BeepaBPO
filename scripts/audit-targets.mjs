/** Dump every interactive element under 44px on a given route + viewport. */
import { chromium } from "@playwright/test";

const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? process.argv[2] ?? "http://localhost:3100";
const ROUTES = process.argv.slice(3);

const browser = await chromium.launch();
for (const route of ROUTES) {
  for (const vp of [
    { w: 375, h: 667, label: "375 mobile" },
    { w: 1024, h: 1366, label: "1024 tablet" },
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      hasTouch: true,
      isMobile: vp.w < 768,
      deviceScaleFactor: vp.w < 768 ? 3 : 1,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const bad = await page.evaluate(() => {
      const out = [];
      const sel =
        'a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (cs.opacity === "0") continue;
        if (el.classList.contains("sr-only")) continue;
        if (el.hasAttribute("data-marquee")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const inlineInProse =
          cs.display === "inline" &&
          el.closest("p, li, dd, span.block") !== null &&
          !el.closest("nav, header, section > div > div");
        if (inlineInProse) continue;
        if (r.width < 44 || r.height < 44) {
          out.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || "").trim().slice(0, 34),
            // Two decimals, not rounded — a failing measurement must not be
            // reported as a passing one (see audit-responsive.mjs).
            w: +r.width.toFixed(2),
            h: +r.height.toFixed(2),
            type: el.getAttribute("type") || "",
            cls: (el.className || "").toString().slice(0, 100),
          });
        }
      }
      return out;
    });

    if (bad.length) {
      console.log(`\n### ${route} @ ${vp.label} — ${bad.length} under 44px`);
      for (const b of bad) {
        console.log(
          `  ${b.tag}${b.type ? `[${b.type}]` : ""} ${b.w}x${b.h}  "${b.text}"  ${b.cls}`,
        );
      }
    }
    await ctx.close();
  }
}
await browser.close();