// Principal-QA sweep: every nav-reachable page, every demo role.
//
// Complements `audit-role-pages.mjs`, which answers "can this role reach the
// page at all?". This one answers "does the page work once you are there?" —
// console errors, uncaught page errors, HTTP status, permission redirects, and
// whether the page is rendering an EMPTY state. That last one is the "real data"
// half of the question: a page that loads cleanly but shows "no records" is not
// ready for real people, and it is invisible to a reachability check.
//
// Read-only. It signs in and navigates; it never writes.
//
// Usage: node scripts/audit/audit-role-sweep.mjs [role ...]
//   role defaults to every demo role. QA_BASE_URL overrides the target, which
//   must already be running (`next start`), since the sweep drives a real server.
// Writes .qa-sweep-report.json.
//
// Two traps this script already hit, both of which produced a report full of
// defects that did not exist:
//   - The app redirects on permission boundaries, so a goto can be overtaken by
//     the app's own navigation. `settle()` waits for the URL to stop moving
//     before the DOM is sampled.
//   - Several pages render TWO <PageHeader> call sites (an early-return variant
//     and the main one). A single-match regex sees only the first.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const PW = env.DEMO_PASSWORD;

const ALL_ROLES = [
  "owner", "superadmin", "hr", "recruiter", "sales", "marketing",
  "operations", "teamlead", "finance", "employee",
  "clientadmin", "clientviewer", "applicant",
];

const only = process.argv.slice(2);
const roles = only.length ? ALL_ROLES.filter((r) => only.includes(r)) : ALL_ROLES;

// Marketing pages are role-independent; swept once.
// (No /industries - it is not a route. CMS industries feed the services pages.)
const MARKETING = [
  "/", "/about", "/why-beepa", "/services", "/careers",
  "/case-studies", "/resources", "/contact", "/privacy", "/terms",
];

const EMPTY_RE = /no (records|data|results|items|entries)|nothing (here|to show)|do not exist|0 results|no .* yet|haven'?t .* yet|empty/i;

/**
 * Wait until the URL stops changing.
 *
 * The app redirects on permission boundaries, so a goto can be overtaken by the
 * app's own navigation ("interrupted by another navigation to /app/dashboard").
 * Sampling the body before that settles reads a half-navigated page and reports
 * it as an error that does not exist.
 */
async function settle(page, quietMs = 1200, maxMs = 9000) {
  let last = page.url();
  let quiet = 0;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(200);
    const now = page.url();
    if (now === last) {
      quiet += 200;
      if (quiet >= quietMs) return true;
    } else {
      last = now;
      quiet = 0;
    }
  }
  return false;
}

/** Evaluate, retrying past the context destruction that follows a navigation. */
async function inspect(page, emptySrc) {
  let lastErr;
  for (let i = 0; i < 4; i += 1) {
    try {
      return await page.evaluate((src) => {
        const t = (document.body?.innerText || "").replace(/\s+/g, " ");
        const re = new RegExp(src);
        return {
          heading: document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? null,
          len: t.length,
          empty: re.test(t.slice(0, 900)),
          errorText: /something went wrong|application error|internal server error|unexpected error/i.test(t.slice(0, 600)),
          hrefs: [...document.querySelectorAll("a[href^='/app']")].map((a) => a.getAttribute("href").split("?")[0]),
          skeletons: document.querySelectorAll('[aria-busy="true"], .animate-pulse').length,
        };
      }, emptySrc);
    } catch (e) {
      lastErr = e;
      if (!/Execution context was destroyed|Target closed/i.test(String(e))) throw e;
      await page.waitForTimeout(600);
    }
  }
  throw lastErr;
}

async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  if (page.url().includes("/login")) return { ok: false, reason: "still on /login" };
  if (page.url().includes("access-denied")) return { ok: false, reason: "redirected to access-denied" };
  return { ok: true, landed: new URL(page.url()).pathname };
}

const browser = await chromium.launch();
const report = { base: BASE, startedAt: new Date().toISOString(), roles: {}, marketing: [] };

// ---- marketing (anonymous) ----
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(`[console] ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => errs.push(`[pageerror] ${String(e).slice(0, 200)}`));
  for (const p of MARKETING) {
    errs.length = 0;
    const row = { path: p, status: "ok", notes: [] };
    try {
      const r = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(700);
      row.http = r?.status();
      if (r && r.status() >= 400) row.status = `http${r.status()}`;
      row.heading = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? null);
      const txt = await page.evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " "));
      if (EMPTY_RE.test(txt.slice(0, 800))) { row.status = "empty-state"; row.notes.push("empty copy in body"); }
      if (/something went wrong|application error|internal server error/i.test(txt.slice(0, 600))) row.status = "PAGE_ERROR_TEXT";
      if (errs.length) row.notes.push(...errs.slice(0, 3));
    } catch (e) { row.status = "THREW"; row.notes.push(String(e).slice(0, 140)); }
    report.marketing.push(row);
  }
  await ctx.close();
}

// ---- per role ----
for (const role of roles) {
  const email = `${role}@demo.beepabpo.com`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const entry = { email, login: null, pages: [], summary: {} };

  const login = await signIn(page, email);
  entry.login = login;
  if (!login.ok) { report.roles[role] = entry; await ctx.close(); continue; }

  // Discover reachable pages from the landing surface. These four are the real
  // route names (app/app/applicant, app/app/approvals).
  const seeds = new Set(["/app/dashboard", "/app/my", "/app/approvals", "/app/applicant"]);
  const seen = new Set();
  const queue = [...seeds];

  while (queue.length && seen.size < 60) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);

    const errs = [];
    const onConsole = (m) => { if (m.type() === "error") errs.push(`[console] ${m.text().slice(0, 200)}`); };
    const onPageErr = (e) => errs.push(`[pageerror] ${String(e).slice(0, 200)}`);
    page.on("console", onConsole);
    page.on("pageerror", onPageErr);

    const row = { path, status: "ok", notes: [] };
    try {
      const r = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 25000 });
      row.http = r?.status();
      await settle(page);
      // A permission redirect is a legitimate outcome, not a failure. Record it.
      const landed = new URL(page.url()).pathname;
      row.landed = landed;
      if (landed !== path && landed !== path + "/") {
        row.status = "redirected";
        row.notes.push(`-> ${landed}`);
      }
      if (r && r.status() >= 400) row.status = `http${r.status()}`;
      if (row.status === "ok" || row.status === "redirected") {
        const info = await inspect(page, EMPTY_RE.source);
        row.heading = info.heading;
        if (info.errorText) row.status = "PAGE_ERROR_TEXT";
        else if (info.empty && row.status === "ok") row.status = "empty-state";
        if (info.skeletons > 0) row.notes.push(`${info.skeletons} skeleton(s) still mounted`);
        if (row.status !== "redirected") for (const h of info.hrefs) if (!seen.has(h) && !queue.includes(h)) queue.push(h);
      }
      if (errs.length) row.notes.push(...errs.slice(0, 3));
    } catch (e) {
      // A route whose whole job is to return a file makes Playwright THROW "Download is
      // starting" -- `page.goto` cannot resolve a navigation that is not a document. That is
      // the route WORKING, and this catch was reporting it as `THREW`, i.e. a page error.
      //
      // `/app/reports/export` produced exactly that: `err=1` on every role holding
      // `reports.export` (superadmin, hr, operations), while the endpoint was serving a CSV
      // perfectly. A check that cannot tell a successful download from a broken page is worse
      // than no check, because it manufactures findings that send you hunting for a defect
      // that was never there.
      const msg = String(e);
      if (/Download is starting/i.test(msg)) {
        row.status = "download";
        row.notes.push("navigation returned a file, not a document (expected for an export route)");
      } else {
        row.status = "THREW";
        row.notes.push(msg.slice(0, 140));
      }
    }
    page.off("console", onConsole);
    page.off("pageerror", onPageErr);
    entry.pages.push(row);
  }

  entry.summary = {
    total: entry.pages.length,
    ok: entry.pages.filter((p) => p.status === "ok").length,
    redirected: entry.pages.filter((p) => p.status === "redirected").length,
    empty: entry.pages.filter((p) => p.status === "empty-state").length,
    download: entry.pages.filter((p) => p.status === "download").length,
    // `download` counts as a clean outcome: the route returned a file, which is its job.
    errors: entry.pages.filter((p) => !["ok", "empty-state", "redirected", "download"].includes(p.status)).length,
    withConsoleNoise: entry.pages.filter((p) => p.notes.some((n) => n.startsWith("["))).length,
  };
  report.roles[role] = entry;
  await ctx.close();
  console.error(`${role.padEnd(13)} pages=${String(entry.summary.total).padStart(3)} ok=${entry.summary.ok} redir=${entry.summary.redirected} empty=${entry.summary.empty} dl=${entry.summary.download} err=${entry.summary.errors} noise=${entry.summary.withConsoleNoise}`);
}

await browser.close();
writeFileSync(".qa-sweep-report.json", JSON.stringify(report, null, 2));
console.error(`\nmarketing problems: ${report.marketing.filter((r) => r.status !== "ok").length}/${report.marketing.length}`);
// Also written under docs/evidence/ so the numbers this report quotes have something behind
// them. A check result printed to a terminal is a claim; the report said "0 page errors" with
// nothing reproducible behind it, because the only artefact lived at the repo root and was
// never tracked. Keep both -- the root file for the script's own contract, this one for review.
try {
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync("docs/evidence/role-sweep.json", JSON.stringify(report, null, 2));
  console.error("wrote docs/evidence/role-sweep.json");
} catch (e) {
  console.error(`could not write docs/evidence/role-sweep.json: ${e.message}`);
}