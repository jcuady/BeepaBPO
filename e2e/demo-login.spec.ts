import { expect, test } from "@playwright/test";

const password = process.env.DEMO_PASSWORD;

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required");
});

test.describe("demo login picker", () => {
  test("employee login lists internal roles and autofills", async ({
    page,
  }) => {
    await page.goto("/employee/login");
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
    await page.waitForURL(/\/app\/my/, { timeout: 30_000 });
  });

  test("client login lists portal roles and autofills client admin", async ({
    page,
  }) => {
    await page.goto("/login");
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
    await page.waitForURL(/\/app\/client/, { timeout: 30_000 });
  });

  test("cross-portal link prefills via ?demo=", async ({ page }) => {
    await page.goto(
      "/employee/login?demo=clientadmin%40demo.beepabpo.com",
    );
    // On employee page, client admin is a cross-link; open client login with query
    await page.goto("/login?demo=clientadmin%40demo.beepabpo.com");
    await expect(page.getByLabel(/email/i)).toHaveValue(
      "clientadmin@demo.beepabpo.com",
    );
    await expect(page.getByLabel(/^password$/i)).toHaveValue(password!);
  });
});
