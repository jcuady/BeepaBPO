import { expect, test, type Page } from "@playwright/test";

const password = process.env.DEMO_PASSWORD;

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required for filter e2e tests");
});

async function employeeLogin(page: Page, email: string) {
  await page.goto("/employee/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password!);
  await page.getByRole("button", { name: /access portal/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

test.describe("list filters", () => {
  test("tickets status filter updates URL", async ({ page }) => {
    await employeeLogin(page, "operations@demo.beepabpo.com");
    await page.goto("/app/tickets");
    await expect(page.getByText(/manage support queues/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('select[name="status"]').selectOption("new");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page).toHaveURL(/status=new/);
  });

  test("applicants stage filter updates URL", async ({ page }) => {
    await employeeLogin(page, "recruiter@demo.beepabpo.com");
    await page.goto("/app/recruitment/applicants");
    await expect(page.getByText(/review candidates/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('select[name="stage"]').selectOption("applied");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page).toHaveURL(/stage=applied/);
  });

  test("crm leads status filter updates URL", async ({ page }) => {
    await employeeLogin(page, "sales@demo.beepabpo.com");
    await page.goto("/app/crm/leads");
    await expect(page.getByText(/inbound leads|pipeline/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.locator('select[name="status"]').selectOption("new");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page).toHaveURL(/status=new/);
  });

  test("leave status filter updates URL", async ({ page }) => {
    await employeeLogin(page, "hr@demo.beepabpo.com");
    await page.goto("/app/leave");
    await expect(page.getByText(/review and action leave/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.locator('select[name="status"]').selectOption("approved");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page).toHaveURL(/status=approved/);
  });
});
