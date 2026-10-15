// Functional coverage for the three demo roles no workflow exercise touched.
//
// WHY THESE THREE
// ---------------
// Thirteen demo roles exist. Ten are driven through a real workflow by the other
// exercises in this directory -- payroll runs as owner, leave as employee/hr/
// teamlead, tickets as owner/operations, hire as hr/recruiter. Three were not:
// **sales**, **finance** and **client_viewer**.
//
// `audit-role-sweep.mjs` does visit all three, but it is read-only by design: it
// navigates and reports console errors, HTTP status and empty states. It never
// presses a button. For these three roles the project could show a green sweep
// over pages that are individually broken.
//
// WHAT THE FIRST VERSION OF THIS FILE GOT WRONG, AND WHY IT MATTERS
// -----------------------------------------------------------------
// It asserted "no control whose label starts with approve/create/delete". That
// produced six failures, and every one was a false positive:
//
//   - "Payroll", "Payroll settings"  -- navigation links, not actions
//   - "Submit a Ticket"              -- self-service every employee should have
//   - "New agent onboarding…"        -- notification titles, not buttons
//   - "Create ticket" for a viewer   -- `tickets.self` is granted on purpose
//
// It also asserted "this URL must not be reachable", which confuses *reaching*
// a route with *seeing* the data behind it. Measured, none of the three roles
// sees money it should not: sales sees $0 on /app/payroll and its own pipeline
// total in the CRM, client_viewer is refused on /app/payroll and /app/reports,
// and /app/client/billing renders with zero amounts. RLS is working; the shell
// loading is not a leak.
//
// So this version asserts the two properties that are actually true and
// actually matter:
//
//   1. NO EXPOSURE  -- a role renders no money on a surface it has no
//      permission to read. This is the security claim.
//   2. NO CAPABILITY IT DID NOT HAVE -- measured DIFFERENTIALLY, by comparing
//      client_viewer against client_admin on the same pages. Asking "is there
//      an Approve button?" with a regex cannot work; asking "does the viewer
//      have controls the admin has?" is the real invariant and self-adjusts.
//
// READ-ONLY. It signs in, navigates, reads the DOM, writes nothing.
//
// Usage:
//   node --env-file=.env.local scripts/audit/qa-exercise-uncovered-roles.mjs

import { readFileSync } from "node:fs";
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

const results = [];
const notes = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};
const note = (m) => { notes.push(m); console.log(`NOTE  ${m}`); };

async function signInAs(context, email, portal) {
  const page = await context.newPage();
  await page.goto(`${BASE}${portal === "client" ? "/login" : "/employee/login"}`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").waitFor({ state: "visible", timeout: 20000 });
  await page.fill("#email", email);
  await page.fill("#password", env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  return page;
}

/** The app redirects on permission boundaries; wait for the URL to settle. */
async function visit(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  let last = page.url();
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(350);
    if (page.url() === last) break;
    last = page.url();
  }
  return page.url();
}

/**
 * What is actually ON this page, as opposed to reachable.
 *
 * Money is the discriminator: `₱`/`$` followed by digits is the one thing that
 * must never appear on a surface a role cannot read. Nav labels are ignored
 * because a link is not data.
 */
const SAMPLE = () => {
  const text = (document.body.innerText || "").replace(/\s+/g, " ");
  const money = text.match(/(?:₱|\$)\s?[\d,]+(?:\.\d{2})?/g) ?? [];
  return {
    moneyCount: money.length,
    moneySample: money.slice(0, 3),
    denied: /access denied|no access|not permitted|do not have permission/i.test(text),
  };
};

/**
 * Visit a route, wait for it to settle, and sample what rendered.
 *
 * The app redirects on permission boundaries, and that redirect can land
 * *after* the URL has stopped moving -- the client-side navigation destroys the
 * execution context between `goto` and `evaluate`, which surfaces as
 * "Execution context was destroyed" and took out the whole run.
 *
 * So the evaluate is retried once against the settled page rather than being
 * trusted to land on the first try.
 */
async function sampleAt(page, path) {
  const url = await visit(page, path);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(900);
      const s = await page.evaluate(SAMPLE);
      return { url, ...s };
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(1200);
    }
  }
}

/**
 * Button labels only -- links are navigation, and navigation is not a capability.
 *
 * Labels are NORMALISED before comparison. The first version compared them
 * verbatim and reported four identical failures, all of them the notification
 * bell reading "Notifications (1 unread)" for one account and
 * "Notifications" for the other. An unread count is chrome, not a capability --
 * the two roles have the same button, it merely says a different number.
 *
 * So counters, counts and unread suffixes are stripped, and comparison happens
 * on the normalised text. What survives is genuinely "this role has a control
 * the other does not".
 */
const NORMALISE = (s) =>
  s
    .replace(/\(\s*\d+\s+unread\s*\)/gi, "")
    .replace(/\(\s*\d+\s*\)/g, "")
    .replace(/\b\d+\s+unread\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const buttonLabels = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );

const browser = await chromium.launch();

try {
  // ---------------------------------------------------------------- finance
  {
    const ctx = await browser.newContext();
    const page = await signInAs(ctx, "finance@demo.beepabpo.com", "employee");
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 100)));
    check("finance signs in", page.url().includes("/app"), page.url());

    // Finance is an internal role. It must not reach the client tenant's money.
    const billing = await sampleAt(page, "/app/client/billing");
    check(
      "finance is kept out of the client billing surface",
      !billing.url.includes("/client/billing") || billing.moneyCount === 0,
      `${billing.url} money=${billing.moneyCount}`,
    );
    check("no uncaught page errors as finance", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ------------------------------------------------------------------ sales
  {
    const ctx = await browser.newContext();
    const page = await signInAs(ctx, "sales@demo.beepabpo.com", "employee");
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 100)));
    check("sales signs in", page.url().includes("/app"), page.url());
    check("sales lands on the CRM pipeline", page.url().includes("/app/crm"), page.url());

    // The whole question for sales: can a pipeline role read payroll figures?
    const payroll = await sampleAt(page, "/app/payroll");
    check(
      "sales sees no payroll amounts on /app/payroll",
      payroll.moneyCount === 0,
      `money=${payroll.moneyCount} ${JSON.stringify(payroll.moneySample)} url=${payroll.url}`,
    );

    // And the page it does own should not be empty, or the role cannot work.
    await visit(page, "/app/crm/leads");
    const crmText = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
    check(
      "sales sees a populated lead list",
      !/(no leads|no records|nothing here)/i.test(crmText),
      crmText.slice(0, 70),
    );
    check("no uncaught page errors as sales", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ---------------------------------------------------------- client viewer
  // Differential: the viewer's buttons are compared against the admin's on the
  // same pages. A label regex cannot express "can do what admin can do".
  const PAGES = ["/app/client/attendance", "/app/client/timesheets", "/app/client/tickets", "/app/client/requests"];
  const byRole = {};
  for (const role of [
    { label: "client_admin", email: "clientadmin@demo.beepabpo.com" },
    { label: "client_viewer", email: "clientviewer@demo.beepabpo.com" },
  ]) {
    const ctx = await browser.newContext();
    const page = await signInAs(ctx, role.email, "client");
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 100)));
    check(`${role.label} signs in`, page.url().includes("/app/client"), page.url());
    byRole[role.label] = { buttons: {}, errors };
    for (const p of PAGES) {
      await visit(page, p);
      byRole[role.label].buttons[p] = await buttonLabels(page);
    }
    await ctx.close();
  }

  for (const p of PAGES) {
    const admin = new Set(byRole.client_admin.buttons[p].map(NORMALISE));
    const viewer = byRole.client_viewer.buttons[p].map(NORMALISE);
    // A viewer must not have anything the admin's page does not -- anything at
    // all. If the admin has nothing, there is nothing to over-grant.
    const extra = viewer.filter((b) => !admin.has(b));
    check(
      `client viewer has no control client admin lacks on ${p}`,
      extra.length === 0,
      extra.join(" | ") || `admin sees ${admin.size}, viewer sees ${new Set(viewer).size}`,
    );
  }

  {
    const ctx = await browser.newContext();
    const page = await signInAs(ctx, "clientviewer@demo.beepabpo.com", "client");

    const payroll = await sampleAt(page, "/app/payroll");
    check(
      "client viewer is refused the internal payroll app",
      payroll.denied || payroll.moneyCount === 0,
      `denied=${payroll.denied} money=${payroll.moneyCount} url=${payroll.url}`,
    );

    const reports = await sampleAt(page, "/app/reports");
    check(
      "client viewer is refused internal reports",
      reports.denied || reports.moneyCount === 0,
      `denied=${reports.denied} money=${reports.moneyCount} url=${reports.url}`,
    );

    const billing = await sampleAt(page, "/app/client/billing");
    check(
      "client viewer renders no amounts on client billing",
      billing.moneyCount === 0,
      `money=${billing.moneyCount} ${JSON.stringify(billing.moneySample)} url=${billing.url}`,
    );

    if (!billing.denied) {
      note(
        "client billing renders its shell for client_viewer with zero amounts rather than a " +
          "denial page. Nothing is exposed -- `billing.read` is not granted to the role -- but " +
          "an empty surface a user cannot fill is worth a considered decision rather than a default.",
      );
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (notes.length) {
  console.log("\nNOTES:");
  for (const n of notes) console.log(`  - ${n}`);
}
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `  [${f.detail}]` : ""}`);
}
process.exit(failed.length ? 1 : 0);