import { test as setup, expect } from "@playwright/test";
import { fillStable } from "./fixtures";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Auth setup: sign in ONCE per role and persist the browser storage state.
 *
 * The previous suite performed a full login inside every single test
 * (13 logins in roles.spec.ts alone). That is the dominant cost of the e2e
 * suite and it is entirely avoidable — the session cookie is the only thing
 * that matters between tests.
 *
 * Produces .auth/<role>.json, consumed by the `chromium` project via
 * `storageState`. Tests that genuinely need a fresh session (auth isolation,
 * logout, open-redirect) should still log in inside the test.
 */

const AUTH_DIR = resolve(process.cwd(), ".auth");

const password = process.env.DEMO_PASSWORD;

// Only the roles a project actually consumes. Every extra sign-in is a real
// request against the auth provider, which is rate limited — adding roles that
// no spec reads only makes setup flakier.
//
// The list covers every role that a11y.spec.ts, viewport.spec.ts, mutations
// and demo-ready previously signed in for on every single run. Those specs now
// call useStoredSession() instead. roles.spec.ts still signs in for real,
// because asserting where each role lands after a genuine login is its entire
// purpose — that is the irreducible cost of this suite.
const ROLES = [
  { role: "owner", email: "owner@demo.beepabpo.com", portal: "employee" as const },
  { role: "employee", email: "employee@demo.beepabpo.com", portal: "employee" as const },
  { role: "hr", email: "hr@demo.beepabpo.com", portal: "employee" as const },
  { role: "marketing", email: "marketing@demo.beepabpo.com", portal: "employee" as const },
  { role: "clientadmin", email: "clientadmin@demo.beepabpo.com", portal: "client" as const },
  { role: "applicant", email: "applicant@demo.beepabpo.com", portal: "client" as const },
];

async function signIn(page: import("@playwright/test").Page, email: string, portal: "employee" | "client") {
  const path = portal === "employee" ? "/employee/login" : "/login";
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await fillStable(page.getByLabel(/email/i), email);
  await fillStable(page.getByLabel(/^password$/i), password!);
  await page
    .getByRole("button", { name: portal === "employee" ? /access portal/i : /sign in/i })
    .click();
  // `waitUntil: "domcontentloaded"` matters here: waiting for the default "load"
  // can hang indefinitely because the app shell holds realtime subscriptions
  // that keep the load event pending. We only need the navigation committed.
  await page.waitForURL(/\/app(\/|$)/, {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });
}

setup("authenticate demo roles", async ({ browser, baseURL }) => {
  // Logging in hits the real auth provider, which is rate limited and can be
  // slow under repeated local runs. Setup legitimately needs a bigger budget
  // than a normal test, and a single retry absorbs transient throttling.
  setup.setTimeout(240_000);

  if (!password) {
    // Without credentials there is nothing to set up. This throws rather than
    // skipping, because the previous behaviour here was actively misleading:
    // the comment claimed "downstream authenticated projects self-skip", and
    // they do not. A skipped dependency does not skip its dependents. So an
    // unauthenticated run produced 14 failures that all looked like product
    // bugs — client routes "redirected away from a client", pages that
    // "did not render a denial" — when the actual cause was one missing env
    // var. Failing here names the real problem in one line.
    throw new Error(
      "DEMO_PASSWORD is not set. The authenticated projects (chromium, owner, client) " +
        "need it and do not self-skip. Set it in .env.local and re-run.",
    );
  }

  mkdirSync(AUTH_DIR, { recursive: true });

  const failedRoles: string[] = [];
for (const { role, email, portal } of ROLES) {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        await signIn(page, email, portal);
        // Confirm the session is genuinely authenticated before persisting it —
        // saving a redirect-to-login state would silently weaken every test
        // that later reads it.
        expect(new URL(page.url()).pathname, `${role} should land inside /app`).toMatch(/^\/app/);
        await context.storageState({ path: resolve(AUTH_DIR, `${role}.json`) });
        await context.close();
        setup.info().annotations.push({
          type: "role",
          description: `${role} authenticated (attempt ${attempt})`,
        });
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        await context.close().catch(() => {});
      }
    }
    if (lastError) {
      failedRoles.push(role);
      console.warn(`[auth.setup] role "${role}" failed after retries: ${String(lastError)}`);
    }
  }

  // ANY failed role is fatal, not just `employee`.
  //
  // Each role here has a project that consumes its storageState. When a role
  // fails to sign in, its file is simply never written — and Playwright does
  // not stop. The dependent project then runs with no session, every route
  // redirects to /login, and the failures read like product bugs rather than an
  // auth problem. One `clientadmin` sign-in failure produced 11 assertions
  // about "redirected away from a client" and "did not render a denial for a
  // client", none of which mentioned authentication.
  //
  // A single throw here turns that into one clear sentence naming the role.
  if (failedRoles.length) {
    throw new Error(
      `auth setup failed for: ${failedRoles.join(", ")}. ` +
        `No storage state was written for ${failedRoles.join(", ")}, so those projects ` +
        `will run unauthenticated. The underlying cause is above — most often auth ` +
        `provider rate limiting after repeated local runs, or a stale session.`,
    );
  }
});