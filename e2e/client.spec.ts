import { test, expect, expectNoConsoleErrors, gotoReady } from "./fixtures";

/**
 * Client-portal surface and its isolation boundaries.
 *
 * This spec exists because `playwright.config.ts` declared a `client` project
 * whose `testMatch` pointed at a file that did not exist — the project passed
 * by asserting nothing at all.
 *
 * Isolation here is the security-relevant part: a client user must reach their
 * own portal and must NOT reach the internal employee tree or admin surfaces.
 */

const CLIENT_ROUTES = [
  "/app/client",
  "/app/client/team",
  "/app/client/attendance",
  "/app/client/timesheets",
  "/app/client/requests",
] as const;

/** Routes denied page-level via `forbidden()` — same URL, denial rendered. */
const DENIED_FOR_CLIENT = [
  "/app/payroll",
  "/app/admin",
  "/app/crm",
  "/app/employees",
] as const;

/**
 * Routes bounced by a segment layout redirect (`my/layout.tsx` checks
 * `workspace.isInternal` and sends non-internal users to /app). These change
 * the URL rather than rendering a denial, so they are asserted separately.
 */
const REDIRECTED_FOR_CLIENT = ["/app/my"] as const;

test.describe("client reaches its own portal", () => {
  test("lands on the client home", async ({ page, consoleErrors }) => {
    await gotoReady(page, "/app/client");
    expect(new URL(page.url()).pathname).toBe("/app/client");
    await expect(page.getByRole("main")).toBeVisible();
    expectNoConsoleErrors(page, consoleErrors);
  });

  for (const route of CLIENT_ROUTES) {
    test(`${route} renders for a client`, async ({ page, consoleErrors }) => {
      await gotoReady(page, route);
      expect(
        new URL(page.url()).pathname,
        `${route} redirected away from a client`,
      ).toBe(route);

      const mainText = (await page.getByRole("main").innerText()).trim();
      expect(mainText.length, `${route} rendered empty for a client`).toBeGreaterThan(20);

      expectNoConsoleErrors(page, consoleErrors);
    });
  }
});

test.describe("client is isolated from internal surfaces", () => {
  for (const route of DENIED_FOR_CLIENT) {
    test(`${route} is refused for a client`, async ({ page }) => {
      await gotoReady(page, route);

      // Scope to the content region: the app shell renders the client sidebar
      // on every route, so the whole-page body tells us nothing about whether
      // the protected resource rendered.
      const body = (await page.getByRole("main").innerText()).trim();

      // The deny mechanism here is Next's `forbidden()`, which renders a
      // forbidden page AT THE SAME URL rather than redirecting. Asserting on a
      // URL change (as an earlier draft did) would have produced a false
      // security finding. The property that matters is that the protected
      // content never reaches the client.
      expect(
        body,
        `${route} did not render a denial for a client. Body was:\n${body.slice(0, 500)}`,
      ).toMatch(/forbidden|403|not authorized|does not have|access denied|no permission/i);

      // And no protected payroll/employee data leaked into the response.
      for (const secret of ["net pay", "grosspay", "gross pay"]) {
        expect(
          body.toLowerCase(),
          `${route} leaked "${secret}" to a client`,
        ).not.toContain(secret);
      }
    });
  }

  for (const route of REDIRECTED_FOR_CLIENT) {
    test(`${route} bounces a client away`, async ({ page }) => {
      await gotoReady(page, route);

      // Segment layouts redirect non-internal users off the employee tree, so
      // the URL must actually change here and land somewhere safe.
      const path = new URL(page.url()).pathname;
      expect(path, `client stayed on ${route}`).not.toBe(route);
      expect(
        ["/app", "/access-denied", "/app/client"],
        `client landed somewhere unexpected after ${route}: ${path}`,
      ).toContain(path);
    });
  }

  test("client portal has no horizontal overflow at 375px", async ({
    page,
    consoleErrors,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, "/app/client/team");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    expectNoConsoleErrors(page, consoleErrors);
  });
});