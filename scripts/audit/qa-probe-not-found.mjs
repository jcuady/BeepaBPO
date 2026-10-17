// Prove the 404 surface actually recovers.
//
// WHY: neither `app/not-found.tsx` nor `app/app/not-found.tsx` existed. Next.js
// served its built-in not-found document — a bare page with **zero links** on it.
// In a tool staff use all day that is a dead end, and it is reachable in normal
// operation: the payroll audit page links to period ids the payroll exercise
// deletes (QA report §6 row 15), so a real user can click their way here.
//
// The assertion that matters is not "a 404 is rendered". It is that the way out
// of the 404 *resolves to a live page*. A 404 that offers a link to another 404
// is still a dead end, and a page-visit sweep will happily score both as clean.
//
// Usage: node scripts/audit/qa-probe-not-found.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fillHeld } from "./lib/browser-form.mjs";
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
const OWNER = "owner@demo.beepabpo.com";
const DEAD = "/__qa_not_found_probe__";
const DEAD_APP = "/app/__qa_not_found_probe__";

const results = [];
const observed = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (m) => console.log(`NOTE  ${m}`);

const browser = await chromium.launch();

async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const field = page.locator("input[name=email], input[type=email]").first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, field, email);
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });
}

// ---- 1. Public 404 ---------------------------------------------------------
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}${DEAD}`, { waitUntil: "domcontentloaded" });
  check("public 404 returns HTTP 404", res?.status() === 404, `status ${res?.status()}`);

  const marker = await page.getAttribute("[data-page-status]", "data-page-status").catch(() => null);
  check("public 404 carries data-page-status=not-found", marker === "not-found", `got ${marker}`);

  const linkCount = await page.locator("a[href]").count();
  check("public 404 is not a dead end (has links)", linkCount > 0, `${linkCount} link(s)`);

  const chrome = await page.evaluate(() => ({
    header: !!document.querySelector("header"),
    footer: !!document.querySelector("footer"),
    h1: document.querySelector("h1")?.innerText ?? null,
  }));
  check("public 404 keeps site chrome (header + footer)", chrome.header && chrome.footer,
    `header ${chrome.header} footer ${chrome.footer}`);
  check("public 404 has a real heading", !!chrome.h1, chrome.h1 ?? "none");

  // The recovery link must resolve. Following it is the whole point.
  await page.click('a[href="/"]');
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 20000 }).catch(() => {});
  const homeRes = await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  check("public 404 'Back to homepage' resolves to a live page", homeRes?.status() === 200,
    `status ${homeRes?.status()}`);
  await ctx.close();
}

// ---- 2. Signed-out deep app link -------------------------------------------
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}${DEAD_APP}`, { waitUntil: "domcontentloaded" });
  const landed = new URL(page.url()).pathname;
  check("signed-out deep app link lands on login, not a bare 404", landed.startsWith("/login"),
    `landed ${landed}`);
  await ctx.close();
}

// ---- 2b. Public `notFound()` really is a 404 -------------------------------
//
// The half of the controlled comparison that matters: a missing CMS slug on the
// SEO surface must return 404, not 200. `/resources/[slug]` calls `notFound()`
// exactly like the app's ticket page does, and it has no `loading.tsx` above
// it — so if this ever regresses to 200, search engines start indexing soft
// 404s on the marketing site.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/resources/qa-no-such-slug-probe`, { waitUntil: "domcontentloaded" });
  check("public CMS slug not-found returns a real HTTP 404", res?.status() === 404, `status ${res?.status()}`);
  const marker = await page.getAttribute("[data-page-status]", "data-page-status").catch(() => null);
  check("public CMS slug not-found carries the marker", marker === "not-found", `got ${marker}`);
  await ctx.close();
}

// ---- 3. Signed-in app 404 ---------------------------------------------------
//
// Two DIFFERENT code paths land on a 404 inside the app, and both are checked.
//
//   (a) An unmatched URL under /app. Matches no segment, so Next renders the
//       ROOT not-found — the public marketing 404 — unless `app/app/[...rest]`
//       catches it first. Before that catch-all existed, a signed-in user was
//       ejected out of the app into the public shell.
//   (b) A `notFound()` call from a record page. 12 app routes call it for a
//       missing ticket, employee, invoice, payroll period, deal, lead or job
//       (counted by scanning app/**/page.tsx, excluding this probe's own
//       catch-all — a naive grep reads 13 because `notFound()` also appears in
//       prose). This is the realistic one: it is what a stale notification
//       link, an old audit row or a deleted record produces.
//
// The assertion that separates the app 404 from the public one is CONTENT, not
// layout. An earlier version of this probe counted `nav a[href]` and passed
// while the marketing header was on screen — a false pass, because the public
// header is also a nav full of links. The discriminators used here are the
// app's own recovery link and the ABSENCE of the marketing footer.
const NOT_A_REAL_ID = "00000000-0000-0000-0000-000000000000";

async function appNotFoundShape(page, label, url) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded" });
  const http = res?.status();

  // NOT a failure, and deliberately not asserted as one: everything under
  // `/app/*` serves its not-found page with HTTP 200, because
  // `app/app/loading.tsx` puts a Suspense boundary above every app page. The
  // response starts streaming with the shell, the status is committed as 200,
  // and the later `notFound()` cannot change it. This is a CONTROLLED
  // COMPARISON, not a guess: the `(marketing)` segment has no `loading.tsx`,
  // and `/resources/<bad-slug>` — which calls the same `notFound()` — correctly
  // returns 404. See QA report §6.
  //
  // Left as-is on purpose. Removing `loading.tsx` would buy a correct status
  // code at the cost of the slow-TLS hang those files exist to prevent, and
  // `/app` is `noindex, nofollow`, so no crawler is affected. The visible page
  // is correct; only monitoring would read a soft-404 as a success.
  observed.push({ label, http, expected: 200, note: "documented soft-404 — see QA report §6" });

  const marker = await page.getAttribute("[data-page-status]", "data-page-status").catch(() => null);
  check(`${label}: renders the not-found surface`, marker === "not-found", `marker ${marker}, http ${http}`);

  const shape = await page.evaluate(() => ({
    recovery: document.querySelectorAll('a[href="/app"]').length,
    marketingFooter: document.querySelectorAll('footer a[href="/services"]').length,
    shellNav: document.querySelectorAll('a[href="/app/dashboard"]').length,
    h1: document.querySelector("h1")?.innerText ?? null,
  }));

  check(`${label}: offers a way back to the app`, shape.recovery > 0, `${shape.recovery} link(s)`);
  check(`${label}: stays in the app shell, not the public marketing 404`,
    shape.marketingFooter === 0 && shape.shellNav > 0,
    `marketingFooter ${shape.marketingFooter}, shellNav ${shape.shellNav}`);
  check(`${label}: has a real heading`, !!shape.h1, shape.h1 ?? "none");
}

{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, OWNER);

  await appNotFoundShape(page, "unmatched app URL", `${BASE}${DEAD_APP}`);
  await appNotFoundShape(page, "deleted record URL", `${BASE}/app/tickets/${NOT_A_REAL_ID}`);

  // Follow the way out. A link that lands on another error page is not a recovery.
  await page.goto(`${BASE}${DEAD_APP}`, { waitUntil: "domcontentloaded" });
  const recovery = page.locator('main a[href="/app"]').first();
  await recovery.click();
  await page.waitForURL((u) => new URL(u).pathname === "/app", { timeout: 25000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  const finalPath = new URL(page.url()).pathname;
  const heading = await page.locator("h1").first().innerText().catch(() => "");
  const landedStatus = await page.evaluate(async () => {
    const r = await fetch(window.location.origin + window.location.pathname, { redirect: "follow" });
    return r.status;
  });
  check("app 404 'Back to dashboard' resolves to a live page",
    landedStatus === 200 && !finalPath.includes("__qa_not_found"),
    `status ${landedStatus} landed ${finalPath} h1 "${heading}"`);
  await ctx.close();
}

await browser.close();

const total = results.length;
const passed = results.filter((r) => r.pass).length;
const failures = total - passed;

mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  "docs/evidence/not-found-check.json",
  JSON.stringify(
    {
      check: "not-found",
      generatedAt: new Date().toISOString(),
      base: BASE,
      total,
      passed,
      failures,
      warnings: 0,
      results,
      observations: observed,
    },
    null,
    2,
  ) + "\n",
);

note(`evidence written to docs/evidence/not-found-check.json`);
console.log(`\n${passed}/${total} passed`);
process.exit(failures > 0 ? 1 : 0);