// Prove the ⌘K command palette is actually operable, and actually navigates.
//
// WHY: the palette is the app's primary navigation affordance — the app header
// advertises it with a literal `⌘K` hint, so every user is told to reach for it.
// Nothing in the existing suite drives it: the role sweep visits pages, the link
// crawl reads `a[href]`, and the palette renders none (cmdk builds its items at
// runtime from the permission set). A palette that opens but cannot be typed
// into, cannot be arrowed, or cannot be left with Escape is invisible to all of
// them.
//
// It also verifies the permission contract: `getCommandLinks` is supposed to
// show each role a different set. A palette that leaks links to a role that
// cannot open them produces 403/404 destinations for a user who was told the
// route exists.
//
// Read-only: every assertion ends on a page load or a state check. Nothing is
// written.
//
// Usage: node scripts/audit/qa-probe-command-palette.mjs

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
const EMPLOYEE = "employee@demo.beepabpo.com";
const DIALOG = '[data-slot="dialog-content"]';

const results = [];
const observations = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (m) => console.log(`NOTE  ${m}`);

const browser = await chromium.launch();

async function signIn(context, email) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, page.locator("input[type=email]").first(), email);
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForFunction(() => !location.pathname.includes("/login"), null, { timeout: 25000 });
  // Hydration must settle before the first keypress. Learned the hard way on the
  // dialog probe: driving the UI before React has attached its listeners misses
  // the interaction and looks like a product defect.
  await page.waitForTimeout(1200);
  return page;
}

const itemTexts = (page) =>
  page.locator('[data-slot="command-item"]').allInnerTexts().catch(() => []);

// ---- 1. Ctrl+K opens it, focus lands in the input ---------------------------
{
  const ctx = await browser.newContext();
  const page = await signIn(ctx, OWNER);
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.keyboard.press("Control+k");
  await page.waitForSelector(DIALOG, { state: "visible", timeout: 10000 }).catch(() => {});
  check("Ctrl+K opens the command palette", (await page.locator(DIALOG).count()) === 1);

  const focused = await page.evaluate(() => {
    const a = document.activeElement;
    const dlg = document.querySelector('[data-slot="dialog-content"]');
    return { inside: !!(dlg && a && dlg.contains(a)), placeholder: a?.getAttribute?.("placeholder") ?? null };
  });
  check("focus lands in the palette input on open", focused.inside && !!focused.placeholder,
    `activeElement placeholder ${focused.placeholder}`);

  // ---- 2. it filters as you type ------------------------------------------
  const allBefore = await itemTexts(page);
  check("palette lists navigation targets", allBefore.length > 0, `${allBefore.length} item(s)`);

  await page.keyboard.type("attendance", { delay: 25 });
  await page.waitForTimeout(400);
  const filtered = await itemTexts(page);
  check("typing filters the list", filtered.length > 0 && filtered.length < allBefore.length,
    `${allBefore.length} -> ${filtered.length} item(s)`);
  check("the filter keeps the thing you searched for",
    filtered.some((t) => /attendance/i.test(t)), filtered.slice(0, 3).join(" | ").slice(0, 90));

  // ---- 3. Enter navigates --------------------------------------------------
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.includes("command"), { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(600);
  const landed = new URL(page.url()).pathname;
  check("Enter navigates to the selected command", /attendance/i.test(landed), `landed ${landed}`);
  check("the palette closes itself after navigating", (await page.locator(DIALOG).count()) === 0);

  // ---- 4. Escape closes, and focus comes back ------------------------------
  // Start from a known focused control so "focus was returned" is provable.
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const anchor = page.locator('a[href="/app/tickets"]').first();
  const hadAnchor = (await anchor.count()) > 0;
  if (hadAnchor) await anchor.focus();

  await page.keyboard.press("Control+k");
  await page.waitForSelector(DIALOG, { state: "visible", timeout: 10000 });
  await page.keyboard.press("Escape");
  await page.waitForSelector(DIALOG, { state: "detached", timeout: 10000 });
  check("Escape closes the palette", (await page.locator(DIALOG).count()) === 0);

  const after = await page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a?.tagName ?? null, href: a?.getAttribute?.("href") ?? null, isBody: a === document.body };
  });
  check("focus is not dumped on <body> after Escape", !after.isBody,
    `activeElement ${after.tag}${after.href ? ` -> ${after.href}` : ""}`);
  if (hadAnchor) {
    check("focus returns to the control that opened the palette", after.href === "/app/tickets",
      `activeElement ${after.tag} -> ${after.href ?? "(none)"}`);
  }

  await ctx.close();
}

// ---- 5. the palette is permission-scoped ------------------------------------
{
  const ownerCtx = await browser.newContext();
  const ownerPage = await signIn(ownerCtx, OWNER);
  const ownerLinks = await (async () => {
    await ownerPage.keyboard.press("Control+k");
    await ownerPage.waitForSelector(DIALOG, { state: "visible", timeout: 10000 });
    const items = await itemTexts(ownerPage);
    await ownerPage.keyboard.press("Escape");
    await ownerPage.waitForSelector(DIALOG, { state: "detached", timeout: 10000 });
    return items;
  })();
  await ownerCtx.close();

  const empCtx = await browser.newContext();
  const empPage = await signIn(empCtx, EMPLOYEE);
  const empLinks = await (async () => {
    await empPage.keyboard.press("Control+k");
    await empPage.waitForSelector(DIALOG, { state: "visible", timeout: 10000 });
    const items = await itemTexts(empPage);
    await empPage.keyboard.press("Escape");
    await empPage.waitForSelector(DIALOG, { state: "detached", timeout: 10000 });
    return items;
  })();
  await empCtx.close();

  const isSubset = empLinks.every((t) => ownerLinks.some((o) => o.trim() === t.trim()));
  check("an employee's palette offers no link the owner's does not", isSubset,
    `owner ${ownerLinks.length} items, employee ${empLinks.length} items`);

  const onlyInEmployee = empLinks.filter((t) => !ownerLinks.some((o) => o.trim() === t.trim()));
  if (onlyInEmployee.length) {
    observations.push({
      label: "employee-only palette links",
      detail: onlyInEmployee.join(" | ").slice(0, 200),
      note: "not necessarily wrong — a role can legitimately be offered a route the owner lacks — but it must be reachable, or the palette lies",
    });
    note(`employee-only links: ${onlyInEmployee.join(" | ").slice(0, 120)}`);
  }
}

await browser.close();

const total = results.length;
const passed = results.filter((r) => r.pass).length;
const failures = total - passed;

mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  "docs/evidence/command-palette-check.json",
  JSON.stringify(
    { check: "command-palette", generatedAt: new Date().toISOString(), base: BASE, total, passed, failures, warnings: 0, observations, results },
    null,
    2,
  ) + "\n",
);

note("evidence written to docs/evidence/command-palette-check.json");
console.log(`\n${passed}/${total} passed`);
process.exit(failures > 0 ? 1 : 0);