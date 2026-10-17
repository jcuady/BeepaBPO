// Where does this app actually keep the signed-in identity?
//
// The identity assertion in `qa-exercise-hire-workflow.mjs` reads localStorage and has now
// returned `null` twice against a page that is plainly signed in ("Demo Recruiter" in the
// header). Guessing a third storage shape would be guesswork, so this dumps what is really
// there: localStorage keys, cookie names, and whether any of them carry the email.
//
// WHY it matters: an identity assertion that always returns null does not verify anything.
// Worse, it fails identically whether the page is correct or the harness is wrong, so it
// cannot tell those two apart -- the exact failure mode this project keeps hitting.
//
// Usage: node scripts/audit/qa-probe-session-identity.mjs

import { readFileSync } from "node:fs";
import { fillHeld, submitAndWaitOutcome } from "./lib/browser-form.mjs";
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
const browser = await chromium.launch();

for (const who of ["recruiter@demo.beepabpo.com", "hr@demo.beepabpo.com"]) {
  // One context per identity: pages in a browser share storage, so a second sign-in on the
  // same context silently replaces the first.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await fillHeld(page, page.locator("input[type=email]"), who);
  await fillHeld(page, page.locator("input[type=password]"), env.DEMO_PASSWORD);
  // Wait for the OUTCOME, not a duration — this probe's whole output is the
  // landing URL, so a fixed sleep made it report whichever leg of the redirect
  // it happened to catch.
  await submitAndWaitOutcome(page, "button[type=submit]", { loginPath: "/login", timeout: 25000 });
  await page.waitForLoadState("domcontentloaded").catch(() => {});

  console.log(`\n=== ${who} ===`);
  console.log(`landed: ${page.url()}`);

  const ls = await page.evaluate(() => {
    const out = {};
    for (const key of Object.keys(window.localStorage)) {
      const raw = window.localStorage.getItem(key) ?? "";
      out[key] = raw.length > 160 ? `${raw.slice(0, 160)}…(${raw.length} chars)` : raw;
    }
    return out;
  });
  const lsKeys = Object.keys(ls);
  console.log(`localStorage keys: ${lsKeys.length ? lsKeys.join(", ") : "(none)"}`);
  for (const [k, v] of Object.entries(ls)) console.log(`  ${k} = ${v}`);

  const cookies = await ctx.cookies();
  console.log(`cookies: ${cookies.length}`);
  for (const c of cookies) {
    let decoded = "";
    try {
      decoded = decodeURIComponent(c.value);
      if (decoded.startsWith("base64-")) decoded = Buffer.from(decoded.slice(7), "base64").toString("utf8");
    } catch { decoded = "(undecodable)"; }
    const emailMatch = decoded.match(/[\w.+-]+@[\w.-]+/);
    console.log(`  ${c.name}  domain=${c.domain}  ${emailMatch ? `EMAIL=${emailMatch[0]}` : `(no email in ${decoded.length} chars)`}`);
    if (decoded.length) console.log(`      ${decoded.slice(0, 140)}`);
  }

  // What the app itself believes, straight from the rendered header.
  const header = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\s+/g, " "));
  console.log(`rendered: ${header}`);
  await ctx.close();
}

await browser.close();