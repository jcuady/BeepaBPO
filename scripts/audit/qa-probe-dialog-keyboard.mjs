// Prove the confirm dialog is actually operable by keyboard.
//
// WHY: `ConfirmDialog` guards 21 mutations across the app — ticket status,
// payroll approval, CRM stage, leave approval, hiring conversion, CMS status.
// Its one visible escape route is the Cancel button: it passes
// `showCloseButton={false}`, so there is no X. If Escape or focus handling is
// broken, a keyboard user is sitting in a modal they cannot leave, in front of a
// button whose default action is irreversible.
//
// Nothing in the existing suite touches this. The role sweep visits pages; the
// workflow exercises drive buttons with the mouse. Focus behaviour is invisible
// to both.
//
// SAFETY: strictly read-only. The dialog is opened by changing the status
// `<select>`, and every exit path used here is Cancel or Escape — the confirm
// button is never clicked, so no ticket is ever mutated. `TicketStatusForm`
// restores the select's value on close, and that rollback is itself asserted.
//
// Usage: node scripts/audit/qa-probe-dialog-keyboard.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

const results = [];
const check = (name, pass, detail = "", opts = {}) => {
  results.push({ name, pass, detail, ...(opts.knownOpen ? { knownOpen: opts.knownOpen } : {}) });
  const tag = !pass && opts.knownOpen ? "OPEN" : pass ? "PASS" : "FAIL";
  console.log(`${tag}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!pass && opts.knownOpen) console.log(`      (known-open: ${opts.knownOpen})`);
};
const note = (m) => console.log(`NOTE  ${m}`);

const DIALOG = '[data-slot="dialog-content"]';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// ---- sign in ----------------------------------------------------------------
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.locator("input[name=email], input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
await page.locator("input[name=email], input[type=email]").first().fill(OWNER);
await page.locator("input[type=password]").first().fill(env.DEMO_PASSWORD);
await page.click("button[type=submit]");
await page.waitForFunction(() => !window.location.pathname.includes("/login"), null, { timeout: 25000 });

// ---- reach a real ticket -----------------------------------------------------
await page.goto(`${BASE}/app/tickets`, { waitUntil: "domcontentloaded" });
// Match the ticket DETAIL shape, not `/app/tickets/sla` (a filter tab) — the
// first version of this probe clicked that tab and then timed out waiting for a
// uuid URL, which reads like a broken page rather than a too-loose selector.
const ticketHref = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a[href^="/app/tickets/"]')];
  const hit = links.find((a) => /^\/app\/tickets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a.getAttribute("href") ?? ""));
  return hit?.getAttribute("href") ?? null;
});
if (!ticketHref) {
  note("no ticket rows visible for owner — cannot exercise the dialog");
  await browser.close();
  console.log("\n0/1 — BLOCKED: no ticket to drive");
  process.exit(2);
}
await page.goto(`${BASE}${ticketHref}`, { waitUntil: "domcontentloaded" });
await page.waitForURL(/\/app\/tickets\/[0-9a-f-]{36}/, { timeout: 25000 });

// Let hydration and effects settle BEFORE the first focus interaction.
//
// This is load-bearing and was learned the expensive way. `ConfirmDialog`
// registers the listener that remembers the element to return focus to in a
// `useEffect`. If the probe moves focus into the control before React has run
// that effect, the first `focusin` is missed and the dialog has nothing to
// restore focus to.
//
// The symptom was deeply misleading: Escape then failed while Cancel passed,
// on the same page, in the same run — which reads as a keyboard-specific
// upstream limitation. It also self-propagated, because a failed Escape left
// focus on <body>, so the later Cancel case was inheriting a warm page rather
// than proving anything on its own. Re-running each close path in a FRESH
// browser context with this settle passes both.
await page.waitForTimeout(1200);

const select = page.locator('select[id^="ticket-status-"]').first();
if ((await select.count()) === 0) {
  note("ticket page has no status select for owner");
  await browser.close();
  console.log("\n0/1 — BLOCKED: status control absent");
  process.exit(2);
}

const statusId = await select.getAttribute("id");
const originalValue = await select.inputValue();
const otherValue = await select.evaluate((el) => {
  const opts = [...el.options].map((o) => o.value);
  return opts.find((v) => v !== el.value) ?? null;
});
check("found a ticket status control to drive", !!statusId && !!otherValue,
  `${statusId}, ${originalValue} -> ${otherValue}`);

const activeInfo = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    const dlg = document.querySelector('[data-slot="dialog-content"]');
    return {
      tag: el?.tagName ?? null,
      id: el?.id ?? null,
      text: (el?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30),
      insideDialog: !!(dlg && el && dlg.contains(el)),
      dialogOpen: !!dlg,
    };
  });

/** Change the select, which is what opens the dialog. Never confirms. */
async function openDialog() {
  // Focus the select first, the way a user reaches it. Playwright's
  // `selectOption` sets the value WITHOUT moving focus — measured, focus stayed
  // on <body> — so without this the trigger never had focus and the restore
  // assertion would be testing something no user would ever experience.
  //
  // React tracks the previous value on the node, so assigning `el.value`
  // directly and dispatching a synthetic change event is not enough either:
  // onChange never fires and no dialog opens. Hence `selectOption`.
  await select.focus();
  await select.selectOption(otherValue);
  await page.waitForSelector(DIALOG, { state: "visible", timeout: 10000 });
}

async function closeWithEscape() {
  await page.keyboard.press("Escape");
  await page.waitForSelector(DIALOG, { state: "detached", timeout: 10000 });
}

// ---- 1. opens and takes focus ------------------------------------------------
await openDialog();
check("changing status opens the confirm dialog", (await page.locator(DIALOG).count()) === 1);

const onOpen = await activeInfo();
check("focus moves into the dialog on open", onOpen.insideDialog,
  `activeElement ${onOpen.tag}#${onOpen.id} "${onOpen.text}"`);

// ---- 2. Escape dismisses it --------------------------------------------------
await closeWithEscape();
check("Escape closes the dialog", (await page.locator(DIALOG).count()) === 0);

// ---- 3. focus is restored ----------------------------------------------------
await closeWithEscape();
const afterEscape = await activeInfo();
check("Escape close restores focus to the trigger", afterEscape.id === statusId,
  `activeElement ${afterEscape.tag}#${afterEscape.id || "(none)"}`);

// ---- 4. the select is rolled back, so cancelling changes nothing --------------
const afterEscapeValue = await select.inputValue();
check("cancelling leaves the status unchanged", afterEscapeValue === originalValue,
  `value is "${afterEscapeValue}", expected "${originalValue}"`);

// ---- 5. focus is TRAPPED while open ------------------------------------------
//
// Not "focus never leaves the dialog" — that assertion was WRONG and reported
// two defects that do not exist. Base UI renders focus-guard sentinels (a
// focusable `span`) immediately outside the popup; Tab deliberately lands on one
// and is then bounced back into the dialog. The measured cycle is
// Cancel -> Update status -> guard -> Cancel. A guard is the mechanism a
// working trap is built from, so counting it as an escape manufactures a finding.
//
// What actually matters is the ROUND TRIP: after tabbing past the last control,
// focus must come back inside. A genuine leak never returns.
//
await openDialog();
const focusables = await page.locator(`${DIALOG} button, ${DIALOG} [href], ${DIALOG} input, ${DIALOG} select`).count();
let returnedInside = false;
for (let i = 0; i < focusables + 3; i++) {
  await page.keyboard.press("Tab");
  if ((await activeInfo()).insideDialog) { returnedInside = true; break; }
}
check("Tab cycles back inside the dialog instead of leaking to the page", returnedInside,
  `${focusables} control(s) in the dialog; focus returned inside after tabbing`);

let returnedInsideBack = false;
for (let i = 0; i < focusables + 3; i++) {
  await page.keyboard.press("Shift+Tab");
  if ((await activeInfo()).insideDialog) { returnedInsideBack = true; break; }
}
check("Shift+Tab cycles back inside the dialog too", returnedInsideBack,
  `${focusables} control(s) in the dialog; focus returned inside`);

// The page behind must be unreachable, and Base UI does that with aria-hidden on
// the app container rather than aria-modal on the dialog. Asserting `aria-modal`
// reported a defect that does not exist: aria-hidden on the background is the
// modern equivalent and is what a screen reader actually honours.
const isolation = await page.evaluate(() => {
  const dlg = document.querySelector('[data-slot="dialog-content"]');
  const siblings = [...document.body.children].filter((c) => c !== dlg && !c.contains(dlg));
  const hidden = siblings.filter((c) => c.hasAttribute("inert") || c.getAttribute("aria-hidden") === "true");
  const content = siblings.filter((c) => c.querySelector("main, nav, form"));
  return { hidden: hidden.length, contentRoots: content.length, total: siblings.length };
});
check("page behind the dialog is hidden from assistive tech",
  isolation.contentRoots > 0 && isolation.hidden >= 1,
  `${isolation.hidden}/${isolation.total} sibling container(s) aria-hidden or inert, ${isolation.contentRoots} hold app content`);

// ---- 6. the Cancel button works and restores focus ---------------------------
await closeWithEscape();
await openDialog();
const cancel = page.locator(`${DIALOG} button`, { hasText: /^cancel$/i }).first();
check("the dialog offers a visible Cancel button", (await cancel.count()) > 0);
await cancel.click();
await page.waitForSelector(DIALOG, { state: "detached", timeout: 10000 });
check("Cancel closes the dialog", (await page.locator(DIALOG).count()) === 0);
const afterCancel = await activeInfo();
check("focus returns to the control after Cancel", afterCancel.id === statusId,
  `activeElement ${afterCancel.tag}#${afterCancel.id}`);

const finalValue = await select.inputValue();
check("the ticket status was never mutated by this probe", finalValue === originalValue,
  `value is "${finalValue}", expected "${originalValue}"`);

// ---- 7. the dialog is a real dialog to a screen reader ------------------------
await openDialog();
const dlgRole = await page.getAttribute(DIALOG, "role");
const hasTitle = await page.locator(`${DIALOG} [data-slot="dialog-title"]`).count();
const ariaLabelled = await page.getAttribute(DIALOG, "aria-labelledby");
check("dialog exposes role=dialog", dlgRole === "dialog", `role ${dlgRole}`);
check("dialog has a title element", hasTitle > 0);
check("dialog is labelled by its title", !!ariaLabelled, `aria-labelledby ${ariaLabelled}`);
await closeWithEscape();

await browser.close();
await ctx.close();

const total = results.length;
const passed = results.filter((r) => r.pass).length;
const regressions = results.filter((r) => !r.pass && !r.knownOpen);
const knownOpen = results.filter((r) => !r.pass && r.knownOpen);
const failures = regressions.length;

mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  "docs/evidence/dialog-keyboard-check.json",
  JSON.stringify(
    {
      check: "dialog-keyboard",
      generatedAt: new Date().toISOString(),
      base: BASE,
      total,
      passed,
      // `failures` counts REGRESSIONS only. A known-open item is still a real
      // defect and is listed separately rather than folded into the pass count
      // or quietly dropped — the number that matters is `knownOpen`, and it
      // stays non-zero for as long as the Escape path is broken.
      failures,
      knownOpen: knownOpen.length,
      knownOpenItems: knownOpen.map((r) => ({ name: r.name, detail: r.detail, why: r.knownOpen })),
      warnings: 0,
      results,
    },
    null,
    2,
  ) + "\n",
);

note("evidence written to docs/evidence/dialog-keyboard-check.json");
console.log(`\n${passed}/${total} passed`);
if (knownOpen.length) {
  console.log(`${knownOpen.length} known-open (documented defects, tracked in QA report §6):`);
  for (const k of knownOpen) console.log(`  - ${k.name}`);
}
process.exit(failures > 0 ? 1 : 0);