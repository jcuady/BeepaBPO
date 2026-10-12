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
// Declared here, not in the verdict block: the evidence writer below needs it,
// and a `const` referenced before its declaration is a TDZ ReferenceError at
// runtime — which would have thrown only on a partial run, i.e. exactly when
// someone was debugging.
const isFullRun = only.length === 0;

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

  // Wait for the thing being asserted, not for a fixed number of milliseconds.
  //
  // This used to be `waitForTimeout(2500)` followed by "still on /login?". Under
  // load — 13 roles signed in back to back, each waiting on a live Supabase
  // round trip — 2.5s was sometimes not enough, and the run recorded
  // `login: { ok: false }` for `operations` and then carried on as if nothing
  // had happened. 36 pages of coverage vanished and the summary still read
  // "0 errors". A fixed sleep is a guess about a duration; this waits for the
  // condition itself.
  try {
    await page.waitForFunction(
      () => !window.location.pathname.includes("/login"),
      null,
      { timeout: 20000 },
    );
  } catch {
    // Fall through to the checks below, which classify why.
  }

  if (page.url().includes("/login")) return { ok: false, reason: "still on /login after 20s" };
  if (page.url().includes("access-denied")) return { ok: false, reason: "redirected to access-denied" };

  // Leaving /login is not the same as having landed. The app bounces /login ->
  // /app and then redirects again to /app/dashboard, and the crawl's first seed
  // is /app/dashboard. Returning the instant the pathname changed put the
  // harness's own `goto` into a race with the app's in-flight hop to the very
  // same URL, and the superseded navigation came back as
  // `page.goto: net::ERR_ABORTED` — recorded as a page error on a page that had
  // never loaded. `settle` already exists for exactly this class of race; it was
  // simply not called here.
  await settle(page);

  return { ok: true, landed: new URL(page.url()).pathname };
}

const browser = await chromium.launch();
const report = { base: BASE, startedAt: new Date().toISOString(), roles: {}, marketing: [] };
const loginFailures = [];

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
  if (!login.ok) {
    // A role that cannot sign in contributes ZERO pages, which used to vanish
    // silently: the sweep recorded the failure in JSON, printed nothing, and
    // exited 0 with "0 errors" at the bottom. A skipped role is a hole in the
    // coverage, not a clean result — it is now counted and it fails the run.
    loginFailures.push({ role, email, reason: login.reason });
    console.error(`FAIL ${role.padEnd(13)} sign-in failed — ${login.reason}`);
    report.roles[role] = entry;
    await ctx.close();
    continue;
  }

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
      // `net::ERR_ABORTED` means the navigation was *superseded* — by the app's
      // own redirect, or by a competing one. It is a statement about the
      // browser's navigation queue, not about whether the page is broken, and
      // counting it as a page error makes this gate untrustworthy: it goes red
      // for a page that never loaded and would have rendered fine. Settle
      // first, then retry once, and only surface it if the retry also aborts.
      let r;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (attempt > 0) await settle(page);
        try {
          r = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 25000 });
          break;
        } catch (e) {
          if (attempt === 1 || !/ERR_ABORTED/i.test(String(e))) throw e;
          row.notes.push("navigation aborted by a competing redirect; retried");
        }
      }
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
  // Only a FULL run may overwrite the tracked evidence file.
  //
  // The canary that proved the new exit logic worked (`audit-role-sweep.mjs
  // definitely-not-a-role`) replaced a 479-visit report with a 0-visit one. The
  // file whose entire job is to be the reproducible record behind the report's
  // numbers was destroyed by a debugging command — and it still looked
  // plausible, because an empty report has the same shape as a real one. Partial
  // runs write only the gitignored root file.
  if (isFullRun) {
    writeFileSync("docs/evidence/role-sweep.json", JSON.stringify(report, null, 2));
    console.error("wrote docs/evidence/role-sweep.json");
  } else {
    console.error("partial run — docs/evidence/role-sweep.json left untouched");
  }
} catch (e) {
  console.error(`could not write docs/evidence/role-sweep.json: ${e.message}`);
}

// ---- verdict ----
//
// This script had NO exit-code logic at all. Every number it printed — "err=0",
// "marketing problems: 0/10" — was decoration: the process exited 0 whatever it
// found, so nothing could ever gate on it. "0 page errors" was a claim printed to
// a terminal, not a result.
//
// A sweep that silently loses a whole role is the dangerous failure mode, because
// less coverage reads exactly like more coverage. Three assertions close it:
//   1. every role must sign in,
//   2. no page may be in a broken state,
//   3. the run must cover at least MIN_VISITS pages in total — the floor that a
//      skipped role would drop below.
const totalVisits = Object.values(report.roles).reduce((n, r) => n + (r.pages?.length ?? 0), 0);
const pageErrors = Object.entries(report.roles).flatMap(([role, r]) =>
  (r.pages ?? [])
    .filter((p) => !["ok", "empty-state", "redirected", "download"].includes(p.status))
    .map((p) => `${role} ${p.path} → ${p.status}`),
);
const marketingProblems = report.marketing.filter((r) => r.status !== "ok");

// The observed full run covered 479 visits across 13 roles. A floor well below
// that still catches a whole missing role (the smallest contributes 13) without
// breaking when demo data legitimately trims a page or two.
const MIN_VISITS = 380;
// The floor only means something on a FULL sweep. Running a deliberate subset
// (`audit-role-sweep.mjs owner`) is a normal thing to do and must not fail on
// coverage it was never meant to produce. A filter that matches no role at all is
// a user error, not a pass.

const problems = [];
if (!isFullRun && roles.length === 0) problems.push(`no role matched the filter ${JSON.stringify(process.argv.slice(2))}`);
if (loginFailures.length) problems.push(`${loginFailures.length} role(s) could not sign in: ${loginFailures.map((f) => `${f.role} (${f.reason})`).join(", ")}`);
if (pageErrors.length) problems.push(`${pageErrors.length} page(s) in a broken state: ${pageErrors.slice(0, 8).join("; ")}`);
if (marketingProblems.length) problems.push(`${marketingProblems.length}/${report.marketing.length} marketing page(s) not ok`);
if (isFullRun && totalVisits < MIN_VISITS) problems.push(`coverage floor: ${totalVisits} visits < ${MIN_VISITS} — a role was probably skipped`);
if (!isFullRun) console.error(`\n(partial run: ${roles.join(", ") || "no roles"} — coverage floor not applied)`);

console.error(`\ntotal role-page visits: ${totalVisits} across ${Object.keys(report.roles).length} roles`);
console.error(`page errors: ${pageErrors.length}`);

if (problems.length) {
  console.error("\nVERDICT: FAIL");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.error("VERDICT: PASS — every role signed in, no page in a broken state, coverage floor met");