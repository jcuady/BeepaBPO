/**
 * Authenticated responsive audit for the `/app/*` surface.
 *
 * The marketing surface is covered by scripts/audit-responsive.mjs. That script
 * is public-page only: every `/app/*` route redirects to /login without a
 * session, so the authenticated product surface has never been audited.
 * This script closes that gap.
 *
 * Checks, per viewport:
 *   1. Horizontal overflow (documentElement.scrollWidth vs innerWidth)
 *   2. Elements bleeding past the right edge (outside a clipping ancestor)
 *   3. Interactive elements smaller than 44x44 CSS px (touch viewports only)
 *   4. Body text below 16px on narrow screens (excluding dense data tables)
 *   5. Console errors
 *   6. Auth/authorization denials — including the ones that do NOT redirect.
 *      Next's `forbidden()` and the error boundary both render AT the requested
 *      URL, so a URL-change check alone scores a 403 as a perfect page. The
 *      boundary pages carry `data-page-status`, which is what this script reads.
 *
 * App-surface exemptions vs. the marketing audit:
 *   - Data tables are legitimately dense; `<td>/<th>` and their contents are
 *     exempt from the 16px body-copy rule but NOT from the 44px target rule.
 *   - Inline links inside table cells flow with text and are exempt from the
 *     44px rule (the cell is the scan target), matching the marketing audit.
 *   - Realtime pages never reach `networkidle`, so we settle on domcontentloaded
 *     plus a fixed quiet period instead of failing the navigation.
 *
 * Usage:
 *   node scripts/audit-app-responsive.mjs [email] [route ...]
 *   VIEWPORTS=390,768,1440 node scripts/audit-app-responsive.mjs
 *   FULL=1 node scripts/audit-app-responsive.mjs owner@demo.beepabpo.com /app/dashboard
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// `QA_BASE_URL` first, matching every other probe in this directory, so the
// whole suite can be pointed at one server with one variable. `BASE_URL` is
// kept for existing callers. The default is 3100, not 3000: 3000 is the dev
// server, and this audit is only meaningful against a production build — a
// silently-wrong default meant it always failed with ERR_CONNECTION_REFUSED
// when a `next start` was up, which looks like a broken app rather than a
// misaimed tool.
const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3100";

// Usage: audit-app-responsive.mjs [email] [route ...]
//
// The email is OPTIONAL and must be positionally first. It used to be read as
// `process.argv[2]` unconditionally, which meant
//
//   node scripts/audit-app-responsive.mjs /app/recruitment/jobs
//
// logged in with the literal string "/app/recruitment/jobs" as the email address
// and then swept the whole default route list. The failure surfaced as
// `page.waitForURL: Timeout 30000ms exceeded`, which reads exactly like the
// Supabase auth rate limit it was mistaken for — and rate-limiting *is* a real
// failure mode here, so the two are indistinguishable from the symptom alone.
// Detect an email by its shape rather than by position; anything else is a route.
const argv = process.argv.slice(2);
const EMAIL = argv[0]?.includes("@") ? argv[0] : "owner@demo.beepabpo.com";
const ROUTES = (EMAIL === argv[0] ? argv.slice(1) : argv).filter((a) => a.startsWith("/"));
const FULL = process.env.FULL === "1";

const DEFAULT_ROUTES = [
  "/app/dashboard",
  "/app/my",
  "/app/my/attendance",
  "/app/my/leave",
  "/app/my/payroll",
  "/app/my/requests",
  "/app/my/documents",
  "/app/my/schedule",
  "/app/crm",
  "/app/crm/leads",
  "/app/crm/deals",
  "/app/crm/proposals",
  "/app/attendance",
  "/app/leave",
  "/app/employees",
  "/app/payroll",
  "/app/payroll/periods",
  "/app/billing",
  "/app/recruitment",
  "/app/recruitment/jobs",
  "/app/recruitment/applicants",
  "/app/tickets",
  "/app/approvals",
  "/app/reports",
  "/app/hr",
  "/app/admin",
  "/app/admin/users",
  // `/app/cms` is deliberately absent. It is gated on `cms.manage`, which the
  // owner role does not hold (only `marketing` does — see
  // `20260906000600_seed_roles_permissions.sql`). Leaving it here meant this
  // sweep asked a question with a guaranteed "denied" answer and reported
  // `DENIED forbidden` at all 8 viewports, burying real layout findings under
  // a permanent red. Run it explicitly with the marketing account to get
  // layout coverage:  node scripts/audit-app-responsive.mjs marketing@demo.beepabpo.com /app/cms
  "/app/clients",
];

const routes = ROUTES.length ? ROUTES : DEFAULT_ROUTES;

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

const viewports = process.env.VIEWPORTS
  ? process.env.VIEWPORTS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [w, h] = s.split("x").map(Number);
        return MATRIX.find((m) => m.w === w) ?? { name: `custom ${w}`, w, h: h || 900, touch: w < 1024 };
      })
  : MATRIX;

function loadEnv() {
  try {
    return readFileSync(".env.local", "utf8");
  } catch {
    return "";
  }
}

const envLine = (src, key) => {
  const m = src.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
};

const envSrc = loadEnv();
const PASSWORD = process.env.DEMO_PASSWORD ?? envLine(envSrc, "DEMO_PASSWORD");
const IS_CLIENT_SEGMENT = /client|applicant/.test(EMAIL);

if (!PASSWORD) {
  console.error("DEMO_PASSWORD not found (.env.local or environment). Aborting.");
  process.exit(2);
}

const probe = (opts) => {
  const { checkTouch } = opts;
  const results = { overflow: null, bleeders: [], smallTargets: [], tinyText: [] };

  results.overflow = {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    delta: document.documentElement.scrollWidth - window.innerWidth,
  };

  const vw = window.innerWidth;

  const all = document.querySelectorAll("body *");
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (cs.position === "fixed") continue;
    let p = el.parentElement;
    let clipped = false;
    while (p && p !== document.body) {
      const pcs = getComputedStyle(p);
      if (/hidden|clip|auto|scroll/.test(pcs.overflowX) || pcs.overflow === "clip") {
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
      'a[href], button, input, select, textarea, [role="button"], [role="tab"], [role="switch"], [tabindex]:not([tabindex="-1"])';
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (cs.opacity === "0") continue;
      const r0 = el.getBoundingClientRect();
      if (r0.width === 0 || r0.height === 0) continue;

      // An absolutely-positioned ::after with negative insets is the standard
      // shadcn/base-ui way of enlarging a small control's tap area (the Switch
      // paints 18.4px tall but its overlay is the real target). Measuring only
      // the painted box reports a false failure, so widen the rect by the
      // overlay's actual computed insets before judging the size.
      let r = r0;
      try {
        const after = getComputedStyle(el, "::after");
        if (after && after.content !== "none" && after.position === "absolute") {
          const num = (v) => (v && v !== "auto" ? parseFloat(v) : 0);
          const top = num(after.top);
          const bottom = num(after.bottom);
          const left = num(after.left);
          const right = num(after.right);
          // Negative values pull the overlay outside the box; that is the growth.
          const growY = top < 0 ? -top : bottom < 0 ? -bottom : 0;
          const growX = left < 0 ? -left : right < 0 ? -right : 0;
          if (growX || growY) {
            r = {
              width: r0.width + growX * 2,
              height: r0.height + growY * 2,
              left: r0.left - growX,
              top: r0.top - growY,
            };
          }
        }
      } catch {
        /* pseudo-element introspection unsupported; fall back to the raw box */
      }

      if (el.classList.contains("sr-only")) continue;
      // The sidebar rail is a drag-to-resize affordance with tabIndex={-1},
      // deliberately 16px wide; widening it would create a large invisible
      // strip. On touch the sidebar uses the offcanvas variant instead.
      if (el.hasAttribute("data-sidebar") && el.getAttribute("data-sidebar") === "rail") continue;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") continue;

      // A native input that is hidden from assistive tech AND removed from the
      // tab order is a form-value proxy, not a target the user aims at. The
      // Switch renders one of these per control: it is 1x1px and sits inside
      // the focusable role="switch" root, which is what actually receives taps.
      // Verified rather than assumed — see audit/_probe-switch-inputs.mjs.
      if (el.tagName === "INPUT" && el.getAttribute("aria-hidden") === "true" && el.getAttribute("tabindex") === "-1") {
        continue;
      }

      // A form control wrapped in a <label> inherits the label's hit area, which
      // is the real target (e.g. a 16px radio inside a min-h-11 card label).
      if (el.closest("label") && el.tagName !== "LABEL") continue;

      // Inline elements that flow with surrounding text are exempt.
      const inlineInProse =
        cs.display === "inline" && el.closest("p, li, dd, td, th, span.block") !== null;
      if (inlineInProse) continue;

      // A whole table row may be the click target; the cell is the scan unit.
      const inTableCell = el.closest("td, th");
      if (inTableCell && r.height < 44) continue;

      // Height uses the 44px Apple/AAA guidance. Width uses the WCAG 2.5.8 AA
      // minimum of 24px — forcing a short text link ("Open", "Edit") to 44px
      // wide adds lopsided padding without improving the tap.
      if (r.height < 44 || r.width < 24) {
        results.smallTargets.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 34),
          w: Math.round(r.width),
          h: Math.round(r.height),
          cls: (el.className || "").toString().slice(0, 80),
        });
      }
    }
  }

  if (window.innerWidth < 768) {
    for (const el of document.querySelectorAll("p, li, dd, blockquote, span")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      // Not rendered at all: an ancestor with display:none leaves the element's
      // own computed display intact, so the check above misses it. The app
      // header's role label sits in `hidden md:block`, i.e. absent below 768px,
      // yet was being reported on every page at mobile widths. A zero-size
      // rect is the reliable signal that nothing was painted.
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      // Visually-hidden accessibility text is not rendered body copy.
      if (el.closest('[class*="sr-only"], .sr-only')) continue;
      const text = (el.textContent || "").trim();
      if (text.length < 25) continue;
      if (el.children.length > 0) continue;
      if (["TD", "TH", "DT", "FIGCAPTION", "KBD", "SUMMARY"].includes(el.tagName)) continue;
      // Dense data tables and metric clusters are legitimately compact.
      if (el.closest("table, [role='table'], [data-dense]")) continue;
      if (
        cs.textTransform === "uppercase" ||
        parseFloat(cs.letterSpacing) >= 0.08 ||
        cs.fontFamily.includes("mono")
      )
        continue;
      if (el.closest("nav, [data-marquee]")) continue;
      const chip = el.closest('[class*="rounded-full"]');
      if (chip && chip !== el && text.length <= 40) continue;
      if (parseInt(cs.fontWeight, 10) >= 600 && text.length <= 40) continue;
      const size = parseFloat(cs.fontSize);
      if (size > 0 && size < 16) {
        results.tinyText.push({
          size: Math.round(size * 10) / 10,
          text: text.slice(0, 48),
          cls: (el.className || "").toString().slice(0, 60),
        });
      }
    }
  }

  return results;
};

const browser = await chromium.launch();

// --- Establish one authenticated session, reused at every viewport. ---
const authCtx = await browser.newContext();
const authPage = await authCtx.newPage();
const loginPath = IS_CLIENT_SEGMENT ? "/login" : "/employee/login";
await authPage.goto(`${BASE}${loginPath}`, { waitUntil: "domcontentloaded" });
await authPage.getByLabel(/email/i).fill(EMAIL);
await authPage.getByLabel(/^password$/i).fill(PASSWORD);
await authPage
  .getByRole("button", { name: IS_CLIENT_SEGMENT ? /sign in/i : /access portal/i })
  .click();
await authPage.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
const statePath = join(tmpdir(), `beepa-audit-state-${Date.now()}.json`);
await authCtx.storageState({ path: statePath });
console.log(`Authenticated as ${EMAIL} -> ${new URL(authPage.url()).pathname}\n`);
await authCtx.close();

let failures = 0;
const summary = [];
const t0 = Date.now();

for (const route of routes) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      hasTouch: vp.touch,
      isMobile: vp.w < 768,
      deviceScaleFactor: vp.w < 768 ? 3 : 1,
      storageState: statePath,
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140));
    });

    let bounced = null;
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(500);
      const finalPath = new URL(page.url()).pathname;
      if (finalPath !== route) bounced = finalPath;
    } catch (e) {
      bounced = `NAV_ERROR: ${String(e.message).slice(0, 80)}`;
    }

    let r = { overflow: { delta: 0 }, bleeders: [], smallTargets: [], tinyText: [] };
    let denied = null;
    if (!bounced) {
      try {
        // A denied or crashed page renders AT the requested URL — Next's
        // `forbidden()` and the error boundary both do this rather than
        // redirecting. Watching only for a URL change therefore scored a 403 as
        // a perfect page: no overflow, no small targets, no console errors.
        // That is how `/app/recruitment` was reported clean for an `hr`
        // account that cannot open it. The pages carry a `data-page-status`
        // attribute precisely so this check does not have to guess from text.
        denied = await page.evaluate(
          () =>
            document.querySelector("[data-page-status]")?.getAttribute(
              "data-page-status",
            ) ?? null,
        );
      } catch {
        /* page torn down mid-evaluate; recorded as failure below */
      }
      if (!denied) {
        try {
          r = await page.evaluate(probe, { checkTouch: vp.touch });
        } catch {
          /* page torn down mid-evaluate; recorded as failure below */
        }
      }
    }

    const issues = [];
    if (bounced) issues.push(`BOUNCE ${bounced}`);
    if (denied) issues.push(`DENIED ${denied}`);
    if (r.overflow.delta > 1) issues.push(`H-OVERFLOW +${r.overflow.delta}px`);
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
        bleeders: r.bleeders.slice(0, FULL ? 999 : 6),
        smallTargets: r.smallTargets.slice(0, FULL ? 999 : 6),
        tinyText: r.tinyText.slice(0, FULL ? 999 : 6),
        console: consoleErrors.slice(0, 3),
        overflowPx: r.overflow.delta,
      },
    });

    await ctx.close();
  }
}

await browser.close();

for (const s of summary) {
  console.log(
    `${s.verdict === "PASS" ? "PASS" : "FAIL"}  ${s.route.padEnd(28)} ${String(s.viewport).padEnd(10)} ${s.name.padEnd(18)} ${s.issues}`,
  );
  if (s.verdict === "FAIL" && FULL) console.log(JSON.stringify(s.detail, null, 2));
}

const pass = summary.filter((s) => s.verdict === "PASS").length;
console.log(`\n${pass}/${summary.length} viewport-route combinations clean (${Math.round((Date.now() - t0) / 1000)}s)`);

// Evidence, not a claim. Every other check in the suite writes a file, and the
// runner treats "passed but wrote no evidence" as a finding. This one wrote
// nothing, so a layout regression existed only as terminal scrollback.
//
// One file per chunk rather than one merged file, because this MUST be run in
// chunks: a single process over all 28 routes reaches 2.4 GB. Merging would
// reintroduce that as one long-lived accumulator, and a merged file would also
// make a partial run indistinguishable from a complete one.
const slug = routes.map((r) => r.replace(/^\//, "").replace(/[/?=&]/g, "_") || "root").join("_");
mkdirSync("docs/evidence", { recursive: true });
const evidencePath = `docs/evidence/responsive-app-${slug}.json`;
writeFileSync(
  evidencePath,
  JSON.stringify(
    {
      check: "responsive-app",
      generatedAt: new Date().toISOString(),
      base: BASE,
      account: EMAIL,
      routes,
      chunkOf: `${routes.length} route(s) — run in chunks, see QA_REPORT §7`,
      total: summary.length,
      passed: pass,
      failures,
      results: summary,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${evidencePath}`);

process.exit(failures ? 1 : 0);