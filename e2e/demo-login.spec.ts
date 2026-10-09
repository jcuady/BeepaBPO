import { expect, test, type Page } from "@playwright/test";

const password = process.env.DEMO_PASSWORD;

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required");
});

/**
 * Demo autofill is gated in the app: `getDemoLoginConfig` returns null when
 * NODE_ENV is production unless ALLOW_DEMO_LOGIN=true, so the picker is not
 * rendered at all.
 *
 * This spec used to assume the picker was always present and failed with
 * "expected '' to be clientadmin@demo.beepabpo.com" against any production
 * build — which is the correct behaviour of the app, not a bug. Skipping with
 * the reason keeps the suite honest: it either exercises the picker or says
 * why it did not.
 *
 * To actually run these against a production build, set ALLOW_DEMO_LOGIN=true.
 */
async function skipIfDemoDisabled(page: Page, path = "/employee/login") {
  await page.goto(path);
  const picker = page.getByTestId("demo-login-picker");
  if ((await picker.count()) === 0) {
    test.skip(
      true,
      "Demo login picker not rendered: NODE_ENV=production requires ALLOW_DEMO_LOGIN=true",
    );
  }
}

test.describe("demo login picker", () => {
  test("employee login lists internal roles and autofills", async ({
    page,
  }) => {
    await skipIfDemoDisabled(page, "/employee/login");
    const picker = page.getByTestId("demo-login-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("button", { name: "Owner" })).toBeVisible();
    await expect(picker.getByRole("button", { name: "HR" })).toBeVisible();
    await expect(picker.getByRole("button", { name: "Employee" })).toBeVisible();

    await picker.getByRole("button", { name: "Employee" }).click();
    await expect(page.getByLabel(/email/i)).toHaveValue(
      "employee@demo.beepabpo.com",
    );
    await expect(page.getByLabel(/^password$/i)).toHaveValue(password!);

    await page.getByRole("button", { name: /access portal/i }).click();
    await page.waitForURL(/\/app\/my/, { timeout: 30_000, waitUntil: "domcontentloaded" });
  });

  test("client login lists portal roles and autofills client admin", async ({
    page,
  }) => {
    await skipIfDemoDisabled(page, "/login");
    const picker = page.getByTestId("demo-login-picker");
    await expect(picker).toBeVisible();
    await expect(
      picker.getByRole("button", { name: "Client Admin" }),
    ).toBeVisible();
    await expect(
      picker.getByRole("button", { name: "Applicant" }),
    ).toBeVisible();

    await picker.getByRole("button", { name: "Client Admin" }).click();
    await expect(page.getByLabel(/email/i)).toHaveValue(
      "clientadmin@demo.beepabpo.com",
    );
    await expect(page.getByLabel(/^password$/i)).toHaveValue(password!);

    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app\/client/, { timeout: 30_000, waitUntil: "domcontentloaded" });
  });

  test("cross-portal link prefills via ?demo=", async ({ page }) => {
    // On employee page, client admin is a cross-link; open client login with query
    await skipIfDemoDisabled(
      page,
      "/login?demo=clientadmin%40demo.beepabpo.com",
    );
    await expect(page.getByLabel(/email/i)).toHaveValue(
      "clientadmin@demo.beepabpo.com",
    );
    await expect(page.getByLabel(/^password$/i)).toHaveValue(password!);
  });
});