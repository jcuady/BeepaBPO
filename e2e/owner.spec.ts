import { test, expect, expectNoConsoleErrors, gotoReady } from "./fixtures";

/**
 * Owner-scoped surface.
 *
 * This spec exists because `playwright.config.ts` declares an `owner` project
 * whose `testMatch` pointed at a file that did not exist — the project passed
 * by asserting nothing at all.
 *
 * Runs with the persisted owner session from e2e/auth.setup.ts.
 */

test.describe("owner reaches owner-only surfaces", () => {
  test("lands on the dashboard", async ({ page, consoleErrors }) => {
    await gotoReady(page, "/app/dashboard");
    expect(new URL(page.url()).pathname).toBe("/app/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    expectNoConsoleErrors(page, consoleErrors);
  });

  for (const route of ["/app/admin", "/app/payroll", "/app/reports"]) {
    test(`${route} is reachable for an owner`, async ({ page, consoleErrors }) => {
      await gotoReady(page, route);

      // The authorization gate must let an owner through rather than bouncing
      // to /app or /access-denied.
      expect(
        new URL(page.url()).pathname,
        `${route} redirected away from an owner`,
      ).toBe(route);

      const mainText = (await page.getByRole("main").innerText()).trim();
      expect(mainText.length, `${route} rendered empty for an owner`).toBeGreaterThan(20);
      expect(mainText).not.toMatch(/access denied|not authorized/i);

      expectNoConsoleErrors(page, consoleErrors);
    });
  }

  test("admin users table renders without horizontal overflow", async ({
    page,
    consoleErrors,
  }) => {
    // Regression guard for the iPad min-width break: SidebarInset needed
    // min-w-0 or the users table forced the whole shell 256px wider than the
    // viewport at 768px.
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoReady(page, "/app/admin/users");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scrollWidth,
      "admin/users overflows at 768px",
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);

    expectNoConsoleErrors(page, consoleErrors);
  });

  test("command palette is usable for an owner", async ({ page, consoleErrors }) => {
    // Regression guard for the P0 where CommandList rendered without a
    // <Command> root and the palette threw on open.
    await gotoReady(page, "/app/dashboard");

    await page.getByRole("button", { name: /search/i }).first().click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder(/search/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    expectNoConsoleErrors(page, consoleErrors);
  });
});