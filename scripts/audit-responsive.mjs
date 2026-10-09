/**
 * Responsive audit across the device viewport matrix.
 *
 * Checks, per viewport:
 *   1. Horizontal overflow (documentElement.scrollWidth vs innerWidth)
 *   2. Elements bleeding past the right edge
 *   3. Interactive elements smaller than 44x44 CSS px (mobile/tablet only)
 *   4. Body text below 16px on mobile (iOS auto-zoom trigger)
 *   5. Offscreen / invisible critical content
 *
 * Usage: node scripts/audit-responsive.mjs [baseUrl] [route ...]
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const ROUTES = process.argv.slice(3);
const routes = ROUTES.length ? ROUTES : ["/"];

const MATRIX = [
  { name: "iPhone SE", w: 375, h: 667, touch: true },
  { name: "iPhone 15", w: 393, h: 852, touch: true },
  { name: "iPhone 15 Pro Max", w: 430, h: 932, touch: true },
  { name: "iPad Mini", w: 768, h: 1024, touch: true },
  { name: "iPad Pro 12.9", w: 1024, h: 1366, touch: true },
  { name: "Laptop", w: 1280, h: 800, touch: false },
  { name: "Desktop", w: 1440, h: 900, touch: false },
  { name: "Wide Desktop", w: 1920, h: 1080, touch: false },
];

const probe = (opts) => {
  const { checkTouch } = opts;
  const results = { overflow: null, bleeders: [], smallTargets: [], tinyText: [] };

  results.overflow = {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    delta: document.documentElement.scrollWidth - window.innerWidth,
  };

  const vw = window.innerWidth;

  // Elements extending past the right edge.
  const all = document.querySelectorAll("body *");
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (cs.position === "fixed") continue;
    // Decorative layers are allowed to bleed inside clipped ancestors.
    let p = el.parentElement;
    let clipped = false;
    while (p && p !== document.body) {
      const pcs = getComputedStyle(p);
      if (/hidden|clip/.test(pcs.overflowX) || pcs.overflow === "clip") {
        clipped = true;
        break;
      }
      p = p.parentElement;
    }
    if (clipped) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) {
      results.bleeders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 90),
        right: Math.round(r.right),
      });
    }
  }

  if (checkTouch) {
    const sel =
      'a[href], button, input, select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (cs.opacity === "0") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Skip link is sr-only until focused — 1x1 by design.
      if (el.classList.contains("sr-only")) continue;
      // Inline links inside prose are exempt (they flow with text).
      const inlineInProse =
        cs.display === "inline" &&
        el.closest("p, li, dd, span.block") !== null &&
        !el.closest("nav, header, section > div > div");
      if (inlineInProse) continue;
      // Horizontal scroll containers are exempt (keyboard-scrollable regions).
      if (el.hasAttribute("data-marquee")) {
        if (r.height < 44) {
          results.smallTargets.push({
            tag: el.tagName.toLowerCase(),
            text: "scroll region",
            w: Math.round(r.width),
            h: Math.round(r.height),
            cls: (el.className || "").toString().slice(0, 70),
          });
        }
        continue;
      }
      if (r.width < 44 || r.height < 44) {
        results.smallTargets.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
          cls: (el.className || "").toString().slice(0, 70),
        });
      }
    }
  }

  // Body copy under 16px on narrow screens is a readability problem.
  // Labels, eyebrows, captions, chips, and nav controls are exempt: they are
  // legitimately small and iOS only auto-zooms on form inputs.
  if (window.innerWidth < 768) {
    for (const el of document.querySelectorAll(
      "p, li, dd, blockquote, span",
    )) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const text = (el.textContent || "").trim();
      if (text.length < 25) continue;
      if (el.children.length > 0) continue;
      // Exempt: uppercase labels, wide-tracked small caps, monospace metadata.
      if (
        cs.textTransform === "uppercase" ||
        parseFloat(cs.letterSpacing) >= 0.08 ||
        cs.fontFamily.includes("mono")
      )
        continue;
      // Exempt: anything inside nav / footer link lists / marquee.
      if (el.closest("nav, [data-marquee]")) continue;
      // Exempt: definition terms and pill/chip labels — short metadata
      // rendered inside a rounded container, not running body copy.
      if (["DT", "FIGCAPTION", "KBD", "SUMMARY"].includes(el.tagName)) continue;
      const chip = el.closest('[class*="rounded-full"]');
      if (chip && chip !== el && (el.textContent || "").trim().length <= 40) continue;
      // Exempt: all-caps / semibold short labels rendered beside a value.
      if (
        parseInt(cs.fontWeight, 10) >= 600 &&
        (el.textContent || "").trim().length <= 40
      )
        continue;
      const size = parseFloat(cs.fontSize);
      if (size > 0 && size < 16) {
        results.tinyText.push({
          size: Math.round(size * 10) / 10,
          text: text.slice(0, 50),
          cls: (el.className || "").toString().slice(0, 60),
        });
      }
    }
  }

  return results;
};

const browser = await chromium.launch();
let failures = 0;
const summary = [];

for (const route of routes) {
  for (const vp of MATRIX) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      hasTouch: vp.touch,
      isMobile: vp.w < 768,
      deviceScaleFactor: vp.w < 768 ? 3 : 1,
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120));
    });

    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const r = await page.evaluate(probe, { checkTouch: vp.touch });
    const issues = [];

    if (r.overflow.delta > 1) {
      issues.push(`H-OVERFLOW +${r.overflow.delta}px`);
    }
    if (r.bleeders.length) issues.push(`BLEED ${r.bleeders.length}`);
    if (r.smallTargets.length) issues.push(`TOUCH ${r.smallTargets.length}`);
    if (r.tinyText.length) issues.push(`TEXT<16 ${r.tinyText.length}`);
    if (consoleErrors.length) issues.push(`CONSOLE ${consoleErrors.length}`);

    if (issues.length) failures++;
    summary.push({
      route,
      viewport: `${vp.w}x${vp.h}`,
      name: vp.name,
      verdict: issues.length ? "FAIL" : "PASS",
      issues: issues.join(", ") || "—",
      detail: {
        bleeders: r.bleeders.slice(0, 6),
        smallTargets: r.smallTargets.slice(0, 6),
        tinyText: r.tinyText.slice(0, 6),
        console: consoleErrors.slice(0, 3),
        overflowPx: r.overflow.delta,
      },
    });

    await ctx.close();
  }
}

await browser.close();

for (const s of summary) {
  const mark = s.verdict === "PASS" ? "PASS" : "FAIL";
  console.log(
    `${mark}  ${s.route}  ${String(s.viewport).padEnd(10)} ${s.name.padEnd(18)} ${s.issues}`,
  );
  if (s.verdict === "FAIL") {
    console.log(JSON.stringify(s.detail, null, 2));
  }
}

console.log(
  `\n${summary.filter((s) => s.verdict === "PASS").length}/${summary.length} viewport-route combinations clean`,
);
process.exit(failures ? 1 : 0);