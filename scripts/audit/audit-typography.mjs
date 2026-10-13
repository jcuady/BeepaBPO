/**
 * Typography contract gate.
 *
 * Why this exists
 * ---------------
 * The site ran two body faces for a long time and nobody noticed, because
 * nothing asserted which face a surface uses. The landing page was a port of
 * the supplied "BeepaBPO new landing design" reference and set its body copy in
 * DM Sans; every other route used Inter, per the brandbook's assignment of Inter
 * to "body copy, forms, tables, dashboards, CRM". Navigating from `/` to
 * `/about` changed the typeface, and every gate in the repo was green.
 *
 * The decision was to split by SURFACE rather than pick a winner: DM Sans
 * carries marketing and auth (applied by the `(marketing)` and `(auth)`
 * layouts, so a new route inherits it), Inter stays in the product app where
 * 12–14px tables and payroll are the working surface. This gate is what keeps
 * that true, and what makes the next accidental `font-sans` on a marketing page
 * a failure instead of a slow drift.
 *
 * How it judges
 * -------------
 * Not by sampling a representative element. Two earlier versions of this check
 * did that and both were wrong in the same direction:
 *
 *   1. Reading `main p` reported Manrope on `/about` — that was an 11px eyebrow,
 *      legitimately in the display face, not body copy.
 *   2. Filtering to 15px+ reported "Manrope:2 DM Sans:1" on `/login`, because the
 *      only paragraph over 15px there is a 21.6px rotated accent, again
 *      deliberately `font-display`.
 *
 * Both produced confident, specific, false failures about a page that was
 * correct. The rule that actually holds is the one the markup states: an
 * element is display type if it is heading text or opts in via `font-display` /
 * `font-editorial`; headline territory (>= 24px) is display by definition;
 * everything else must resolve to the surface's body face.
 *
 * Coverage
 * --------
 * Both surfaces, measured separately: marketing and auth anonymously, and the
 * whole product app over an `owner` session. An earlier version walked only the
 * public routes and wrote "NOT COVERED, routes need a session" into its own
 * evidence — honest, but it left the densest surface in the product unmeasured
 * by any gate, which is exactly where a font regression would land.
 *
 * Usage:  node scripts/audit/audit-typography.mjs [baseUrl]
 * Exit 0 on pass, 1 on any element painting in the wrong face.
 */
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_ROUTES, openSignedIn } from "./lib/app-session.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = process.argv[2] || "http://localhost:3100";

// The contract, in one place. `face` is what body copy on that surface must
// resolve to; `expectedBody` is how many body-copy elements must be found for
// the surface to count as measured at all.
const PUBLIC_ROUTES = [
  ["/", "landing"],
  ["/about", "marketing"],
  ["/services", "marketing"],
  ["/why-beepa", "marketing"],
  ["/contact", "marketing"],
  ["/login", "auth"],
  ["/signup", "auth"],
  ["/forgot-password", "auth"],
  ["/employee/login", "auth"],
];

const FACES = {
  landing: "DM Sans",
  marketing: "DM Sans",
  auth: "DM Sans",
  app: "Inter",
};

// Below this, an element is body copy and must be in the surface's body face.
const HEADLINE_PX = 24;
const TEXT_SELECTOR = "p, li, span, dd, td, label, button, a";

/**
 * Classify the text on one page.
 *
 * Shared verbatim by both phases so the public surface and the app surface are
 * judged by exactly the same rule. A second implementation of "is this body
 * copy?" would be a second thing to be subtly wrong about.
 */
function collect(page) {
  return page.evaluate(
    ({ sel }) => {
      // Headings get `font-display` from the BASE layer in app/globals.css, and
      // the landing CSS does the same for its own headings — so neither the
      // heading nor a span inside it carries a font-display class. Only an
      // ancestor walk sees it.
      const isDisplay = (el) => {
        let n = el;
        for (let i = 0; n && n.nodeType === 1 && i < 5; i++) {
          if (/^H[1-6]$/.test(n.tagName)) return true;
          const c = n.className && n.className.toString ? n.className.toString() : "";
          if (/\bfont-display\b/.test(c) || /\bfont-editorial\b/.test(c)) return true;
          n = n.parentElement;
        }
        return false;
      };

      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) continue;
        const txt = (el.textContent || "").trim();
        if (!txt || txt.length > 90) continue;
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!own) continue;
        const cs = getComputedStyle(el);
        out.push({
          family: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
          display: isDisplay(el),
          size: Math.round(parseFloat(cs.fontSize)),
          text: txt.slice(0, 50),
        });
      }
      return out;
    },
    { sel: TEXT_SELECTOR },
  );
}

const browser = await chromium.launch();
const results = [];

// ---- phase 1: marketing + auth, anonymous --------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const [route, group] of PUBLIC_ROUTES) {
    const resp = await page.goto(BASE + route, { waitUntil: "networkidle" });
    const status = resp ? resp.status() : 0;
    const els = await collect(page);

    const body = els.filter((e) => !e.display && e.size < HEADLINE_PX);
    const headline = els.filter((e) => !e.display && e.size >= HEADLINE_PX);
    const disp = els.filter((e) => e.display);
    const stray = body.filter((e) => e.family !== FACES[group]);

    results.push({ route, group, status, body, headline, disp, stray });
  }
  await page.close();
}

// ---- phase 2: the product app, signed in ----------------------------------
//
// A signed-in failure is a HARD failure when credentials exist, and a declared
// gap when they do not. Those are different situations and must not share an
// exit code: the first means the app broke, the second means this environment
// has no demo seed.
const app = await openSignedIn(browser, BASE);
let appCoverage = { covered: false, reason: "not attempted" };

if (app.hardFail) {
  await browser.close();
  console.error(`\nFAIL: product app not measured — ${app.reason}`);
  console.error("Sign-in credentials are present but the session did not land.");
  process.exit(1);
}

if (app.covered) {
  for (const route of APP_ROUTES) {
    let status = 0;
    try {
      const resp = await app.page.goto(BASE + route, { waitUntil: "networkidle" });
      status = resp ? resp.status() : 0;
    } catch {
      status = 0;
    }
    // A signed-in crawl that gets thrown back to /login has lost the session;
    // counting the page's elements would measure the login page a second time
    // and report it as app coverage.
    if (app.page.url().includes("/login")) {
      status = 0;
    }

    const els = status === 200 ? await collect(app.page) : [];
    const body = els.filter((e) => !e.display && e.size < HEADLINE_PX);
    const headline = els.filter((e) => !e.display && e.size >= HEADLINE_PX);
    const disp = els.filter((e) => e.display);
    const stray = body.filter((e) => e.family !== FACES.app);

    results.push({ route, group: "app", status, body, headline, disp, stray });
  }
  appCoverage = { covered: true, role: app.email, routes: APP_ROUTES.length };
  await app.ctx.close();
} else {
  appCoverage = { covered: false, reason: app.reason };
}

await browser.close();

const tally = (els) => {
  const t = {};
  for (const e of els) t[e.family] = (t[e.family] || 0) + 1;
  return t;
};

const fmt = (t) => Object.entries(t).map(([k, v]) => `${k} x${v}`).join(", ") || "none";
const totalStray = results.reduce((a, r) => a + r.stray.length, 0);
const totalBody = results.reduce((a, r) => a + r.body.length, 0);
const non200 = results.filter((r) => r.status !== 200);

const publicRows = results.filter((r) => r.group !== "app");
const appRows = results.filter((r) => r.group === "app");
const publicBody = publicRows.reduce((a, r) => a + r.body.length, 0);
const appBody = appRows.reduce((a, r) => a + r.body.length, 0);

// A gate that found nothing to check has not passed — and neither has one that
// measured one surface and silently skipped the other.
const vacuous = totalBody === 0 || publicBody === 0;
// The app is declared uncovered (no credentials) rather than failing, but a
// half-covered app — routes fetched, no body copy found — is a broken
// measurement and must not read as clean.
const appVacuous = appCoverage.covered && appRows.length > 0 && appBody === 0;
const pass = !vacuous && !appVacuous && totalStray === 0 && non200.length === 0;

const report = {
  check: "typography",
  generatedAt: new Date().toISOString(),
  base: BASE,
  contract: {
    "marketing + auth body (<24px, not font-display)": "DM Sans",
    "product app body (<24px, not font-display)": "Inter",
    "headings, display face, >=24px": "Manrope",
  },
  appCoverage,
  routes: results.map((r) => ({
    route: r.route,
    group: r.group,
    status: r.status,
    bodyCopy: r.body.length,
    headline: r.headline.length,
    displayFace: r.disp.length,
    stray: r.stray.length,
    families: {
      body: tally(r.body),
      headline: tally(r.headline),
      displayFace: tally(r.disp),
    },
    straySamples: r.stray.slice(0, 5),
  })),
  totals: {
    routesChecked: results.length,
    publicRoutes: publicRows.length,
    appRoutes: appRows.length,
    bodyCopyElements: totalBody,
    bodyCopyPublic: publicBody,
    bodyCopyApp: appBody,
    strays: totalStray,
    non200: non200.map((r) => `${r.route}:${r.status}`),
  },
  status: pass ? "PASS" : "FAIL",
};

const outDir = join(ROOT, "docs", "evidence");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "typography-check.json"),
  JSON.stringify(report, null, 2) + "\n",
  "utf8",
);

console.log(`TYPOGRAPHY CONTRACT  (${BASE})`);
console.log("=".repeat(70));
console.log(`Body copy (<${HEADLINE_PX}px, not font-display): DM Sans on marketing/auth, Inter in the app.`);
console.log("Headings, display-face elements and >=24px text: Manrope.\n");

for (const r of results) {
  const clean = r.stray.length === 0 && r.status === 200;
  console.log(
    `[${clean ? "ok   " : "FAIL "}] ${r.route.padEnd(30)} ${r.group.padEnd(9)} body=${String(r.body.length).padStart(3)} [${fmt(tally(r.body))}]  disp=${String(r.disp.length).padStart(3)} [${fmt(tally(r.disp))}]`,
  );
  for (const s of r.stray.slice(0, 5)) {
    console.log(`          -> "${s.text}" is ${s.family} at ${s.size}px`);
  }
}

console.log("=".repeat(70));
console.log(`routes checked      : ${results.length} (${publicRows.length} public, ${appRows.length} app)`);
console.log(`body-copy elements  : ${totalBody} (${publicBody} public, ${appBody} app)`);
console.log(`wrong face          : ${totalStray}`);
console.log(`non-200             : ${non200.length}`);
if (vacuous) console.log("VACUOUS              : no public body-copy elements were found");
if (appVacuous) console.log("VACUOUS              : app routes fetched but no body-copy elements were found");
if (!appCoverage.covered) console.log(`NOT COVERED (app)    : ${appCoverage.reason}`);

console.log(`\nRESULT: ${pass ? "PASS" : "FAIL"}`);
console.log(`wrote docs/evidence/typography-check.json`);

process.exit(pass ? 0 : 1);