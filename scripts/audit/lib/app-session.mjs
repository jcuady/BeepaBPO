// Shared signed-in session for the gates that must measure the product app.
//
// `audit-contrast.mjs` and `audit-typography.mjs` both walked only public and
// auth routes, and both wrote "NOT COVERED, routes need a session" into their
// evidence. That was honest but it left the densest, most-used surface in the
// product unmeasured by any gate — 12–14px tables, payroll, CRM, admin — which
// is precisely where a contrast or font regression would land unnoticed.
//
// The sign-in pattern is the one `audit-role-sweep.mjs` already uses: drive the
// real `/login` form, wait for the *condition* rather than a fixed sleep, and
// fail loudly if it does not land. The app bounces /login -> /app -> /app/
// dashboard, so a goto can be overtaken by the app's own hop; that race is why
// `settle()` exists in the sweep and why it is reproduced here.
//
// Read-only. It signs in and navigates; it never writes.

import { readFileSync } from "node:fs";
import { fillHeld } from "./browser-form.mjs";

/** Minimal `.env.local` reader. Same shape as the other audit scripts. */
export function loadEnvLocal(file = ".env.local") {
  const env = {};
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return env;
  }
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

/**
 * Every static app route the `owner` demo role reaches, as recorded by
 * `audit-role-sweep.mjs`.
 *
 * Dynamic routes (`[id]`) are excluded deliberately: their URLs are per-record
 * and change as the demo data changes, so a gate built on them would either go
 * stale or fail for reasons unrelated to what it measures. `owner` is used
 * because it is the broadest single role — it reaches the admin, hr, payroll,
 * crm, recruitment and client-portal hubs in one session.
 */
export const APP_ROUTES = [
  "/app/dashboard",
  "/app",
  "/app/my",
  "/app/my/attendance",
  "/app/my/schedule",
  "/app/my/leave",
  "/app/my/payroll",
  "/app/my/cash-advances",
  "/app/my/nte",
  "/app/my/requests",
  "/app/my/documents",
  "/app/my/notifications",
  "/app/my/profile",
  "/app/my/support",
  "/app/hr",
  "/app/hr/nte",
  "/app/attendance",
  "/app/attendance/corrections",
  "/app/payroll",
  "/app/payroll/settings",
  "/app/payroll/periods",
  "/app/billing",
  "/app/recruitment",
  "/app/recruitment/jobs",
  "/app/recruitment/applicants",
  "/app/applicant",
  "/app/crm",
  "/app/crm/leads",
  "/app/crm/deals",
  "/app/crm/proposals",
  "/app/clients",
  "/app/tickets",
  "/app/tickets/sla",
  "/app/reports",
  "/app/cms",
  "/app/admin",
  "/app/admin/users",
  "/app/admin/organizations",
  "/app/admin/audit",
  "/app/admin/workflows",
  "/app/employees",
  "/app/approvals",
  "/app/leave",
  "/app/cash-advances",
];

/** Wait until the URL stops moving — the app redirects on permission boundaries. */
export async function settle(page, ms = 400) {
  let last = page.url();
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(ms);
    const now = page.url();
    if (now === last) return;
    last = now;
  }
}

/**
 * Open a browser context signed in as `owner`.
 *
 * Returns `{ covered: false, reason }` when there is no `DEMO_PASSWORD` — an
 * absent demo credential is a fact about the environment, not a regression, so
 * the caller reports the gap rather than failing on it. But it returns a hard
 * failure when credentials exist and the sign-in does not land: that means the
 * seed or the login flow broke, and a gate must not quietly measure less than
 * it used to.
 */
export async function openSignedIn(browser, base) {
  const env = loadEnvLocal();
  const password = process.env.DEMO_PASSWORD || env.DEMO_PASSWORD;

  if (!password) {
    return { covered: false, reason: "no DEMO_PASSWORD in .env.local — app routes not measured" };
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const email = "owner@demo.beepabpo.com";

  try {
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await fillHeld(page, page.locator("input[type=email]"), email);
    await fillHeld(page, page.locator("input[type=password]"), password);
    await page.click("button[type=submit]");

    // Wait for the condition, not a guessed duration.
    await page.waitForFunction(() => !window.location.pathname.includes("/login"), null, {
      timeout: 20000,
    });
    await settle(page);

    if (page.url().includes("/login")) {
      await ctx.close();
      return { covered: false, hardFail: true, reason: `owner sign-in did not land (still on /login)` };
    }
    if (page.url().includes("access-denied")) {
      await ctx.close();
      return { covered: false, hardFail: true, reason: "owner sign-in redirected to access-denied" };
    }

    return { covered: true, ctx, page, email };
  } catch (err) {
    await ctx.close();
    return { covered: false, hardFail: true, reason: `owner sign-in threw: ${err.message}` };
  }
}