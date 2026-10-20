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
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

// Base URL resolution, in the order: `QA_BASE_URL` (matching every other probe
// here), then a positional base URL, then the production port.
//
// The positional value is matched BY SHAPE, not by position. This script
// documents its usage as `[baseUrl] [route ...]`, which quietly makes the first
// route optional — and then `node audit-responsive.mjs /about` sets BASE to the
// string "/about" and every navigation goes to a relative path that resolves
// nowhere. The run then prints nothing and exits 1, which is indistinguishable
// from the site being broken.
//
// `audit-app-responsive.mjs` hit exactly this with its email argument and fixed
// it by detecting a value by shape (`includes("@")`) rather than by position.
// Same rule, applied here to a URL.
const argv = process.argv.slice(2);
const POSITIONAL_BASE = argv[0] && /^https?:\/\//i.test(argv[0]) ? argv[0] : null;
const BASE = process.env.QA_BASE_URL ?? POSITIONAL_BASE ?? "http://localhost:3100";
const ROUTES = POSITIONAL_BASE ? argv.slice(1) : argv;
const routes = ROUTES.length ? ROUTES : ["/"];

// Refuse to narrow the evidence — checked HERE, before any browser work, so a
// bad invocation costs a second rather than the eight minutes the full matrix
// takes.
//
// With no route arguments this script defaults to `["/"]`, which is a perfectly
// good default for "is the landing page fine on a phone" and a terrible one for
// regenerating a committed evidence file. It is registered in qa-run-all.mjs
// with all ten public routes spelled out, so the committed file holds 80
// route-viewport combinations. Running it bare produced 8, wrote them to the
// same path, and shrank a thousand lines of committed evidence — with a clean
// "8/8 clean" printed at the bottom and nothing saying the file had just lost
// nine routes.
//
// So: if the file on disk already covers routes this run does not, name them and
// exit non-zero. Restoring coverage then has to be a deliberate act, instead of
// something a later reader notices by diffing a JSON file.
const EVIDENCE_PATH = "docs/evidence/responsive-public.json";
if (existsSync(EVIDENCE_PATH)) {
  try {
    const prior = JSON.parse(readFileSync(EVIDENCE_PATH, "utf8"));
    const priorRoutes = [...new Set((prior.results || []).map((r) => r.route))];
    const dropped = priorRoutes.filter((r) => !routes.includes(r));
    if (dropped.length) {
      console.error(
        `\nREFUSING TO NARROW THE EVIDENCE.\n` +
          `  ${EVIDENCE_PATH} currently covers ${priorRoutes.length} route(s); this run covers ${routes.length}.\n` +
          `  Would drop: ${dropped.join(", ")}\n` +
          `  No routes were passed, so this defaulted to ["/"] — fine for a spot check,\n` +
          `  wrong for regenerating the file. Pass them explicitly:\n` +
          `    node scripts/audit-responsive.mjs "/" "/about" "/services" "/why-beepa" "/contact" "/privacy" "/terms" "/case-studies" "/careers" "/resources"\n` +
          `  (qa-run-all.mjs already registers exactly that.)`,
      );
      process.exit(1);
    }
  } catch (e) {
    // An unreadable prior file is not a reason to refuse to write a fresh one.
    console.log(`note: could not read prior evidence (${e.message}) — writing fresh.`);
  }
}

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
      //
      // This exemption used to add `&& !el.closest("nav, header, section > div > div")`,
      // which made it wrong on exactly the pages that matter most. The legal
      // pages nest as `section > Container(div) > content div > p > a`, so the
      // link's OWN content div matches `section > div > div` and the exemption
      // switched itself off — reporting the "contact form" link in a Privacy
      // Policy paragraph as a 99x20 touch-target failure. The clause was meant
      // to distinguish "not really prose" and distinguished nothing: prose in a
      // marketing page lives inside a section like everything else.
      //
      // Exempt on what is actually observable — the link is `display: inline`
      // and sits in a text-flowing ancestor. A standalone CTA like "Read case
      // study" is `inline-block`, so it is still caught, which is correct.
      const inlineInProse =
        cs.display === "inline" &&
        el.closest("p, li, dd, blockquote, figcaption, h1, h2, h3, h4, h5, h6") !== null;
      if (inlineInProse) continue;
      // Horizontal scroll containers are exempt (keyboard-scrollable regions).
      if (el.hasAttribute("data-marquee")) {
        if (r.height < 44) {
          results.smallTargets.push({
            tag: el.tagName.toLowerCase(),
            text: "scroll region",
            // Two decimals, not rounded. A target 43.578px wide FAILS the 44px
            // rule, and `Math.round` printed it as `44` — an evidence file that
            // says "w: 44, h: 44" next to verdict FAIL reads like a broken
            // check rather than a broken target. The number has to be the one
            // the rule actually compared.
            w: +r.width.toFixed(2),
            h: +r.height.toFixed(2),
            cls: (el.className || "").toString().slice(0, 70),
          });
        }
        continue;
      }
      // WCAG 2.5.8 "Equivalent". The rule and the reasoning live in
      // scripts/audit/touch-target-rule.mjs, which has its own unit tests;
      // this probe only supplies the measured geometry.
      const label =
        el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const labelEl = label || el.closest("label");
      const activates = !!(labelEl && (
        (labelEl.getAttribute("for") || "") === el.id ||
        (el.id && labelEl.contains(el))
      ));
      const labelRect = labelEl ? labelEl.getBoundingClientRect() : null;
      if (window.__passesTouchTarget({ width: r.width, height: r.height }, { labelRect, activates }))
        continue;
      results.smallTargets.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 40),
        // Two decimals, not rounded — see the note on the scroll-region branch
        // above. A failing measurement must not be reported as a passing one.
        w: +r.width.toFixed(2),
        h: +r.height.toFixed(2),
        cls: (el.className || "").toString().slice(0, 70),
      });
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

// The touch-target rule lives in its own module so it can be unit-tested
// without importing this file — importing it would run the entire audit. The
// probe runs inside the page, where `import` does not exist, so the same
// source is injected as an init script. One definition, two consumers.
const touchRuleSource = readFileSync(
  new URL("./audit/touch-target-rule.mjs", import.meta.url),
  "utf8",
)
  .replace(/^export\s+/gm, "")
  .concat("\nwindow.__passesTouchTarget = passesTouchTarget;");

for (const route of routes) {
  for (const vp of MATRIX) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      hasTouch: vp.touch,
      isMobile: vp.w < 768,
      deviceScaleFactor: vp.w < 768 ? 3 : 1,
    });
    const page = await ctx.newPage();
    await page.addInitScript({ content: touchRuleSource });
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

const passed = summary.filter((s) => s.verdict === "PASS").length;
console.log(`\n${passed}/${summary.length} viewport-route combinations clean`);

// Evidence, not a claim — see the identical block in audit-app-responsive.mjs.
// This check had no evidence file at all, so a public-surface layout regression
// existed only as terminal scrollback while every other check in the suite
// persisted a record.
mkdirSync("docs/evidence", { recursive: true });

writeFileSync(
  EVIDENCE_PATH,
  JSON.stringify(
    {
      check: "responsive-public",
      generatedAt: new Date().toISOString(),
      base: BASE,
      routes,
      total: summary.length,
      passed,
      failures,
      results: summary,
    },
    null,
    2,
  ) + "\n",
);
console.log("wrote docs/evidence/responsive-public.json");

process.exit(failures ? 1 : 0);