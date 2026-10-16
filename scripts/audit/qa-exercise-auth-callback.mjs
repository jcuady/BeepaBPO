/**
 * Exercise `/auth/callback`, the route every failed signup and reset link lands on.
 *
 * WHY THIS ROUTE MATTERED AND WHY NOTHING CAUGHT IT
 * `/auth/callback` has carried a failure redirect to `/login?error=auth_callback` since
 * it was written. `auth_callback` appeared exactly ONCE in the entire codebase -- on the
 * line that produced it. Nothing read it: the login page's searchParams type was
 * `{ next?: string; demo?: string }`, and there is no `useSearchParams` call anywhere in
 * the app. So the parameter was produced and consumed by no one.
 *
 * The user-visible consequence is the whole failure path of two flows. A person asks to
 * reset a password, the emailed link expires or is clicked twice, and they arrive at a
 * plain "Welcome back" login form with no message. Nothing says the link died. The only
 * reasonable reading is that nothing happened, so they request the same email again.
 *
 * The fix reads the parameter and explains it. The exercise below is what proves it, and
 * is also what proves the fix did not overreach into echoing arbitrary input or showing
 * the banner on every ordinary sign-in.
 *
 * WHAT IS AND IS NOT COVERED
 *   covered    - the no-code branch, the bad-code branch (which really does call
 *                `exchangeCodeForSession` and really does fail), that the failure is
 *                visible to the person, that it is absent from a normal sign-in, and
 *                that an arbitrary `?error=` is not reflected back into the page.
 *   not covered - the SUCCESS branch: a genuine PKCE `code` exchanged for a session and
 *                redirected to `next`. Minting one requires the emailed link, so delivery
 *                is still the blocker. Reported, not claimed. See the note at the bottom.
 *
 * The success branch was checked rather than assumed blocked. `admin.generateLink` does
 * return a recovery token with no mail sent, but it produces an IMPLICIT-flow token:
 * `/auth/v1/verify` answered 303 with `#access_token=…&refresh_token=…` and no `?code=`.
 * The product does not use that entry point -- `forgotPasswordAction` calls
 * `resetPasswordForEmail`, which mints a PKCE code that IS delivered by mail. So a
 * fragment-shaped token says nothing about whether the app's `?code` reader is right, and
 * treating that probe as evidence of a product bug would have been wrong.
 *
 * Usage: node scripts/audit/qa-exercise-auth-callback.mjs
 */

import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const EVIDENCE = "docs/evidence/auth-callback-check.json";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

async function main() {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

    // ---- leg 1: no code at all -> the failure branch ----
    // `redirect: "manual"` so the redirect itself is asserted rather than inferred
    // from where the browser happened to end up.
    const noCode = await fetch(`${BASE}/auth/callback`, { redirect: "manual" });
    const noCodeLocation = noCode.headers.get("location") ?? "";
    check(
      "no code redirects to login carrying the error code",
      noCode.status === 307 && noCodeLocation.endsWith("/login?error=auth_callback"),
      `status=${noCode.status} location=${noCodeLocation}`,
    );

    // ---- leg 2: a bad code -> the exchange is really attempted ----
    // Same redirect as leg 1. On its own that cannot distinguish "handled the
    // failure" from "never tried the exchange at all", which is why the next check
    // exists: this one pins the redirect, the next one pins that nothing was signed in.
    const badCode = await fetch(`${BASE}/auth/callback?code=qa-not-a-real-pkce-code`, {
      redirect: "manual",
    });
    const badCodeLocation = badCode.headers.get("location") ?? "";
    check(
      "a bad code is exchanged, fails, and takes the same failure branch",
      badCode.status === 307 && badCodeLocation.endsWith("/login?error=auth_callback"),
      `status=${badCode.status} location=${badCodeLocation}`,
    );

    // And the failed exchange must not have left a usable session behind.
    await page.goto(`${BASE}/auth/callback?code=qa-not-a-real-pkce-code`, {
      waitUntil: "domcontentloaded",
    });
    check(
      "the failed exchange signs nobody in",
      page.url().includes("/login"),
      `landed on ${page.url()}`,
    );

    // ---- leg 3: the person is TOLD. This is the defect and the fix. ----
    //
    // Measured content, not a role count. The login page ALWAYS carries an empty
    // `div[role="alert"]` -- an app-level live region that is on the page whether or
    // not anything went wrong -- so `page.locator('[role="alert"]').count()` returns
    // 1 on a perfectly healthy sign-in. Counting that made this leg pass for the
    // wrong reason on `.first()` and made the negative legs below fail against a
    // fixed product. `p[role="alert"]` is the convention every auth form error in
    // this repo already uses, so it isolates the notice; the text assertions are
    // what actually carry the claim.
    const MESSAGE = /invalid or has expired/i;
    const authAlerts = async () => {
      const loc = page.locator("p[role=alert]");
      const n = await loc.count();
      const parts = [];
      for (let i = 0; i < n; i++) parts.push(await loc.nth(i).innerText());
      return parts.join(" | ").replace(/\s+/g, " ").trim();
    };

    await page.goto(`${BASE}/login?error=auth_callback`, { waitUntil: "domcontentloaded" });
    const deadLinkAlerts = await authAlerts();
    check(
      "a dead link explains itself instead of failing silently",
      MESSAGE.test(deadLinkAlerts),
      deadLinkAlerts ? `alert reads: ${deadLinkAlerts.slice(0, 90)}` : "no p[role=alert] rendered",
    );

    // The message has to be actionable, not just present. A dead link's only correct
    // next moves are signing in or asking for another one, and the page offers the
    // second only via the existing "Forgot password?" control.
    const hasRecoveryRoute = await page.locator('a[href="/forgot-password"]').count();
    check(
      "the dead-link message leaves a way forward on the page",
      hasRecoveryRoute > 0,
      `forgot-password links on page = ${hasRecoveryRoute}`,
    );

    // ---- leg 4: an ordinary sign-in shows nothing ----
    // Guards the fix from becoming a permanent red banner. Without this leg, "render
    // the notice whenever ?error is present" would pass leg 3 and be wrong here.
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const plainAlerts = await authAlerts();
    check(
      "a normal sign-in shows no link error",
      plainAlerts === "",
      `alerts=${plainAlerts === "" ? "(none)" : plainAlerts.slice(0, 80)}`,
    );

    // ---- leg 5: an arbitrary ?error= is not echoed back ----
    // The parameter is attacker-controlled, so the mapper must return null for anything
    // it does not recognise rather than reflecting it into the page.
    //
    // Scoped to RENDERED text on purpose. The raw value legitimately appears several
    // times in the HTML -- Next.js serialises searchParams into its RSC flight
    // payload -- so asserting on page source would fail here for a reason that is not
    // a defect. What matters is whether a person can SEE it.
    const canary = "CANARY_echoed_error_value";
    await page.goto(`${BASE}/login?error=${canary}`, { waitUntil: "domcontentloaded" });
    const canaryBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const canaryAlerts = await authAlerts();
    check(
      "an unrecognised ?error= is neither rendered nor echoed",
      !canaryBody.includes(canary) && !canaryAlerts.includes(canary),
      `canary in visible text=${canaryBody.includes(canary)}, in alerts=${canaryAlerts.includes(canary)}`,
    );

    check("0 console errors", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
    await ctx.close();
  } finally {
    await browser.close().catch(() => {});
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exitCode = 1;
  })
  .finally(() => {
    const failed = results.filter((r) => !r.pass);
    const when = new Date().toISOString();
    // Written on the failure and throw paths too. Evidence that only appears on a
    // clean run records nothing about the defect it was written to catch.
    writeFileSync(
      EVIDENCE,
      `${JSON.stringify(
        {
          check: "auth-callback",
          script: "scripts/audit/qa-exercise-auth-callback.mjs",
          baseUrl: BASE,
          when,
          assertions: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
          details: results,
          notCovered: [
            "the success branch: a genuine PKCE code exchanged for a session and redirected to next. Minting one requires the emailed link, so delivery is the blocker.",
            "that the emailed link arrives at all.",
          ],
          verdict: failed.length ? "fail" : "pass",
        },
        null,
        2,
      )}\n`,
    );
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) process.exitCode = 1;
    console.log("NOT COVERED: the success branch and email delivery — a real PKCE code arrives by mail.");
  });