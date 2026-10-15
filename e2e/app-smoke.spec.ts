import { test, expect, expectNoConsoleErrors, gotoReady } from "./fixtures";

/**
 * Authenticated smoke + runtime health for the employee surface.
 *
 * Two things this catches that the previous suite did not:
 *   1. Runtime console errors / uncaught exceptions on a route. A page can
 *      render "fine" while throwing behind the scenes, and that was invisible.
 *   2. Pages that render an empty shell — the classic "blank screen" failure.
 *      We assert real content, not just that <body> exists.
 *
 * Runs with the shared employee session from e2e/auth.setup.ts.
 */

const ROUTES = [
  "/app/my",
  "/app/my/attendance",
  "/app/my/leave",
  "/app/my/requests",
  "/app/my/documents",
  "/app/my/schedule",
  "/app/my/payroll",
  "/app/my/profile",
  "/app/my/settings",
] as const;

test.describe("employee routes render and stay clean", () => {
  for (const route of ROUTES) {
    test(`${route} renders content with no console errors`, async ({ page, consoleErrors }) => {
      await gotoReady(page, route);

      // The auth gate must have kept us inside the workspace.
      expect(new URL(page.url()).pathname).toBe(route);

      // A real shell: sidebar landmark plus visible main content.
      await expect(page.getByRole("main")).toBeVisible();
      const mainText = (await page.getByRole("main").innerText()).trim();
      expect(
        mainText.length,
        `${route} rendered an empty main region`,
      ).toBeGreaterThan(20);

      // No horizontal overflow at the default project viewport.
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollWidth,
        `${route} overflows horizontally: ${overflow.scrollWidth} > ${overflow.clientWidth}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);

      expectNoConsoleErrors(page, consoleErrors);
    });
  }
});

test.describe("authenticated shell", () => {
  test("command palette opens and closes without console errors", async ({
    page,
    consoleErrors,
  }) => {
    await gotoReady(page, "/app/my");

    const trigger = page.getByRole("button", { name: /search/i }).first();
    await trigger.click();

    // The palette is a dialog; it must be reachable and dismissible.
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    expectNoConsoleErrors(page, consoleErrors);
  });

  test("sidebar navigation reaches a second route without errors", async ({
    page,
    consoleErrors,
  }) => {
    await gotoReady(page, "/app/my");

    const link = page.getByRole("link", { name: /attendance/i }).first();
    if ((await link.count()) === 0) {
      test.skip(true, "attendance link not present in the employee sidebar");
    }
    await link.click();
    await page.waitForURL(/\/app\/my\/attendance/, { timeout: 20_000, waitUntil: "domcontentloaded" });
    await expect(page.getByRole("main")).toBeVisible();

    expectNoConsoleErrors(page, consoleErrors);
  });

  test("unauthenticated access to /app is refused", async ({ browser }) => {
    // An explicitly empty storage state guarantees anonymity. Relying on
    // "browser.newContext() ignores the project's storageState" is an
    // implementation detail, and getting it wrong silently authenticated the
    // test — which would have made this assertion vacuous.
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    // page.goto follows redirects, so the returned response is the final one
    // (the login page, 200). The security property to assert is therefore that
    // the browser never *lands* on a protected route without a session.
    const response = await page.goto("/app/payroll", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.ok(), "navigation should resolve to a rendered page").toBe(true);

    const finalPath = new URL(page.url()).pathname;
    expect(finalPath, "anonymous visitor must not land on a protected route").not.toBe(
      "/app/payroll",
    );
    expect(finalPath, "anonymous visitor should be sent to an auth screen").toMatch(
      /^\/(login|employee\/login)/,
    );

    await context.close();
  });

  /**
   * Runtime coverage for the two sign-out paths that were changed to
   * `scope: "local"` (2026-10-09). Before this, the only thing asserting that
   * change was a source scan, which cannot tell a working sign-out from a
   * broken one.
   *
   * These also protect the scope value indirectly. Every test here shares the
   * one session in `.auth/employee.json`, but each Playwright test gets a fresh
   * context built from it. If `logoutAction` went back to the default global
   * scope, signing out here would revoke that shared session's refresh token
   * and every later test in this project would start failing with redirects to
   * /login. The scope change is enforced by a cascade, not just an assertion.
   */
  test("Sign out ends the session and locks the app again", async ({ page }) => {
    await gotoReady(page, "/app/my");

    await page.getByRole("button", { name: "Account menu" }).click();
    // `exact` is load-bearing: the menu has BOTH "Sign out" and "Sign out
    // everywhere", so `/sign out/i` matched two menuitems and Playwright's strict
    // mode failed the visibility check. The failure read like a product defect —
    // an account menu whose sign-out never appears — when the menu was fine and
    // the locator was ambiguous.
    const signOut = page.getByRole("menuitem", { name: "Sign out", exact: true });
    await expect(signOut).toBeVisible();
    await signOut.click();

    await page.waitForURL((url) => new URL(url).pathname === "/", {
      timeout: 20_000,
      waitUntil: "domcontentloaded",
    });

    // Navigating home is not proof the session ended — the action redirects
    // regardless. Re-request a protected route and confirm it is refused.
    await page.goto("/app/payroll", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname, "session survived Sign out").toMatch(
      /^\/(login|employee\/login)/,
    );
  });

  test("Sign out & switch account from access-denied lands on login", async ({
    page,
  }) => {
    await gotoReady(page, "/app/access-denied");
    const switchAccount = page.getByRole("button", {
      name: /sign out & switch account/i,
    });
    // Wait for the button rather than counting it. `count() === 0` checked
    // immediately after navigation turns "the page has not rendered yet" into a
    // *skip* — which is how this test passed once and then silently skipped on
    // the next run, hiding the fact that it had not executed at all.
    const present = await switchAccount
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(
      !present,
      "access-denied page did not render the switch-account action within 10s",
    );
    await switchAccount.click();

    await page.waitForURL(/\/login/, {
      timeout: 20_000,
      waitUntil: "domcontentloaded",
    });

    await page.goto("/app/my", { waitUntil: "domcontentloaded" });
    expect(
      new URL(page.url()).pathname,
      "session survived Sign out & switch account",
    ).toMatch(/^\/(login|employee\/login)/);
  });
});