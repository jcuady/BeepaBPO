import { expect, test, type Page } from "@playwright/test";

const password = process.env.DEMO_PASSWORD;

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required");
});

async function employeeLogin(page: Page, email: string) {
  await page.goto("/employee/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password!);
  await page.getByRole("button", { name: /access portal/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

async function clientLogin(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

test.describe("auth guards", () => {
  test("unauthenticated /app redirects to login", async ({ page }) => {
    await page.goto("/app/employees");
    await page.waitForURL(/\/(login|employee\/login)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/login/);
  });

  test("employee without tickets.read cannot open tickets", async ({
    page,
  }) => {
    await employeeLogin(page, "employee@demo.beepabpo.com");
    await page.goto("/app/tickets");
    await expect(
      page.getByRole("heading", { name: "Access not allowed" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("demo landmines", () => {
  test("superadmin Jump in does not link to forbidden Employees", async ({
    page,
  }) => {
    await employeeLogin(page, "superadmin@demo.beepabpo.com");
    await page.goto("/app/dashboard");
    await expect(page.getByText(/organization-wide overview/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("link", { name: /^employees$/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^users$/i })).toBeVisible();
  });

  test("employee does not see Approvals in admin nav", async ({ page }) => {
    await employeeLogin(page, "employee@demo.beepabpo.com");
    await page.goto("/app/my");
    await expect(page.getByRole("link", { name: /^approvals$/i })).toHaveCount(
      0,
    );
  });

  test("applicant portal shows seeded application", async ({ page }) => {
    await clientLogin(page, "applicant@demo.beepabpo.com");
    await page.goto("/app/applicant");
    await expect(
      page.getByText(/customer support specialist|screening|application/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
