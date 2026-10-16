/**
 * Per-role functional crawl of the `/app/*` surface.
 *
 * The responsive auditor asks "does this URL render cleanly?". This asks the
 * question a user actually cares about: **"is every page this role can see
 * actually reachable and working?"** It reads the rendered sidebar, so a route
 * that is invisible to the role is never tested and a route that is visible but
 * broken is always caught.
 *
 * That distinction matters. Static RBAC audits confirm each page *declares* a
 * permission check; they do not confirm the nav agrees with the page. A role can
 * be shown a link by the nav and then 403'd by the page, which is the worst
 * possible outcome — an affordance that promises something it cannot deliver.
 *
 * A page fails when it:
 *   - bounces to a different URL (segment-layout redirect, login, /app/my),
 *   - renders a `data-page-status` boundary (forbidden / error),
 *   - logs a console error.
 *
 * Usage:
 *   node scripts/audit-role-pages.mjs [email ...]
 *   ROLES=hr,recruiter,sales,marketing,operations,superadmin node scripts/audit-role-pages.mjs
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
// `@playwright/test`, not `playwright` — the bare package is not resolvable from
// this workspace (pnpm + the pinned playwright-core override), matching
// scripts/audit-app-responsive.mjs.
import { chromium } from "@playwright/test";

// `QA_BASE_URL` first, matching the other 44 audit scripts in this repo.
//
// This read `BASE_URL` only, defaulting to port 3000, while every other audit
// defaults to 3100 — the port `npx next start -p 3100` serves, which is what the
// docs tell an operator to run. The result was a confident, entirely fictional
// report: "0/13 nav-reachable role pages clean" and "13 page(s) a role can SEE
// but cannot USE", all thirteen produced by ERR_CONNECTION_REFUSED against a
// server that was running the whole time on a different port.
//
// `BASE_URL` is still honoured so any existing caller keeps working.
const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3100";

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

if (!PASSWORD) {
  console.error("DEMO_PASSWORD not found (.env.local or environment). Aborting.");
  process.exit(2);
}

const DEFAULT_ROLES = [
  "owner",
  "superadmin",
  "hr",
  "recruiter",
  "sales",
  "marketing",
  "operations",
  "teamlead",
  "finance",
  "employee",
  "clientadmin",
  "clientviewer",
  "applicant",
];

const EMAILS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (process.env.ROLES
      ? process.env.ROLES.split(",").map((r) => `${r.trim()}@demo.beepabpo.com`)
      : DEFAULT_ROLES.map((r) => `${r}@demo.beepabpo.com`));

const isClientSegment = (email) => /client|applicant/.test(email);

async function login(browser, email) {
  // Supabase rate-limits repeated auth from one IP, and this script logs in
  // once per role back-to-back. A single retry with a pause absorbs that; a
  // genuine credential failure still fails loudly on the second attempt.
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      const loginPath = isClientSegment(email) ? "/login" : "/employee/login";
      await page.goto(`${BASE}${loginPath}`, { waitUntil: "domcontentloaded" });
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).fill(PASSWORD);
      await page
        .getByRole("button", {
          name: isClientSegment(email) ? /sign in/i : /access portal/i,
        })
        .click();
      await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
      const state = await ctx.storageState();
      await ctx.close();
      return state;
    } catch (e) {
      lastError = e;
      await ctx.close();
      if (attempt === 1) await new Promise((r) => setTimeout(r, 45_000));
    }
  }
  throw lastError;
}

/** Every `/app/*` href the rendered navigation actually exposes to this role. */
async function navHrefs(page) {
  return page.evaluate(() => {
    const hrefs = new Set();
    for (const a of document.querySelectorAll('a[href^="/app"]')) {
      const href = a.getAttribute("href");
      if (href) hrefs.add(href);
    }
    return [...hrefs];
  });
}

const results = [];
const dispatchNoteByEmail = new Map();
const browser = await chromium.launch();

for (const email of EMAILS) {
  let state;
  try {
    state = await login(browser, email);
  } catch (e) {
    results.push({ email, route: "(login)", status: "LOGIN-FAIL", detail: String(e.message).slice(0, 90) });
    dispatchNoteByEmail.set(email, "");
    continue;
  }

  const ctx = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let routes;
  try {
    await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    routes = await navHrefs(page);
  } catch {
    routes = [];
  }

  // The dashboard you land on may not be linked from the sidebar.
  const home = new URL(page.url()).pathname;
  if (home.startsWith("/app") && !routes.includes(home)) routes.push(home);
  routes = [...new Set(routes)].sort();

  // `/app` is a dispatcher, not a page: it forwards internal users to
  // `/app/my` and client users to `/app/client`. Counting that redirect as a
  // failure would report the router working correctly as a defect.
  const dispatchOnly = routes.filter((r) => r === "/app");
  routes = routes.filter((r) => r !== "/app");

  // Skip deep routes we cannot discover from a sidebar link alone.
  const crawlable = routes.filter((r) => !/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(r));

  for (const route of crawlable) {
    const p = await ctx.newPage();
    const consoleErrors = [];
    p.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120));
    });
    let status = "PASS";
    let detail = "";
    try {
      const resp = await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 25_000 });
      await p.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
      await p.waitForTimeout(300);
      // Compare path *and* query. Several nav items are pre-filtered links
      // (`/app/crm/leads?status=new`); `URL.pathname` drops the search string,
      // so comparing pathname alone reported those as bounces.
      const landed = new URL(p.url());
      const landedWithSearch = `${landed.pathname}${landed.search}`;
      if (landedWithSearch !== route) {
        status = "BOUNCE";
        detail = landedWithSearch;
      } else {
        const marker = await p
          .evaluate(() => document.querySelector("[data-page-status]")?.getAttribute("data-page-status") ?? null)
          .catch(() => null);
        if (marker) {
          status = "DENIED";
          detail = marker;
        } else if (resp && resp.status() >= 400) {
          status = "HTTP";
          detail = String(resp.status());
        } else if (consoleErrors.length) {
          status = "CONSOLE";
          detail = `${consoleErrors.length} error(s): ${consoleErrors[0]}`;
        }
      }
    } catch (e) {
      status = "NAV-ERROR";
      detail = String(e.message).slice(0, 90);
    }
    await p.close();
    results.push({ email, route, status, detail });
  }

  await ctx.close();
  dispatchNoteByEmail.set(
    email,
    dispatchOnly.length ? `  (/app dispatcher -> ${home}, not crawled)` : "",
  );
}

await browser.close();

let failures = 0;
const byRole = new Map();
for (const r of results) {
  if (!byRole.has(r.email)) byRole.set(r.email, []);
  byRole.get(r.email).push(r);
}

for (const [email, rows] of byRole) {
  console.log(`\n=== ${email} ===`);
  for (const r of rows) {
    if (r.status !== "PASS") {
      failures++;
      console.log(`  FAIL  ${r.route.padEnd(34)} ${r.status.padEnd(10)} ${r.detail}`);
    }
  }
  const pass = rows.filter((r) => r.status === "PASS").length;
  const dispatchNote = dispatchNoteByEmail.get(email) ?? "";
  console.log(`  ${pass}/${rows.length} nav-reachable pages clean${dispatchNote}`);
}

// Evidence, not a claim. This script used to end at `process.exit` having
// written nothing, so its result existed only as terminal scrollback — and three
// documents disagreed about it: the completion matrix carried "222/222,
// verified today", the ledger carried "219/219, re-run 2026-10-09", and neither
// number had a file behind it. The repo's own rule is that a green check with no
// evidence file is a finding, not a pass; this check was exactly that, and the
// numbers drifted because nothing pinned them.
//
// Every other audit in this suite writes here. Matching them is what makes the
// matrix row traceable to a run rather than to somebody's memory.
const EVIDENCE = "docs/evidence/role-pages.json";
mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  EVIDENCE,
  JSON.stringify(
    {
      check: "role-pages",
      generatedAt: new Date().toISOString(),
      base: BASE,
      roles: [...byRole.keys()],
      roleCount: byRole.size,
      total: results.length,
      passed: results.length - failures,
      failures,
      // Both figures, because they are different measurements and conflating
      // them is how 222 and 219 ended up in the same argument.
      claim: "every page a role's own nav makes visible is reachable and working",
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(`\nwrote ${EVIDENCE}`);

console.log(
  `\n${results.length - failures}/${results.length} nav-reachable role pages clean.`,
);
if (failures) console.log(`${failures} page(s) a role can SEE but cannot USE.`);
process.exit(failures ? 1 : 0);