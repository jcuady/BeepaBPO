import { expect, test, type Page } from "@playwright/test";

const password = process.env.DEMO_PASSWORD;

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required for mutation e2e tests");
});

async function employeeLogin(page: Page, email: string) {
  await page.goto("/employee/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password!);
  await page.getByRole("button", { name: /access portal/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

test.describe("mutations", () => {
  test("employee can submit a leave request", async ({ page }) => {
    await employeeLogin(page, "employee@demo.beepabpo.com");
    await page.goto("/app/my/leave");
    await expect(page.getByText(/request time off/i)).toBeVisible({
      timeout: 15_000,
    });

    const typeSelect = page.locator("#leave_type_id");
    await expect(typeSelect).toBeVisible();
    const options = typeSelect.locator("option");
    const count = await options.count();
    test.skip(count < 2, "No leave types seeded for demo employee");

    await typeSelect.selectOption({ index: 1 });

    const start = new Date();
    start.setDate(start.getDate() + 14);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

    await page.locator("#start_date").fill(toIsoDate(start));
    await page.locator("#end_date").fill(toIsoDate(end));
    await page.locator("#reason").fill("E2E leave smoke");
    await page.getByRole("button", { name: /submit leave request/i }).click();

    await expect(page.getByText(/leave request submitted|submitted/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("leave approve opens confirm and cancel does not mutate", async ({
    page,
  }) => {
    await employeeLogin(page, "hr@demo.beepabpo.com");
    await page.goto("/app/leave?status=pending");
    const approve = page.getByRole("button", { name: /^approve$/i }).first();
    const visible = await approve.isVisible().catch(() => false);
    test.skip(!visible, "No pending leave requests to confirm");

    await approve.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(approve).toBeVisible();
  });

  test("ticket create form validates required fields", async ({ page }) => {
    await employeeLogin(page, "employee@demo.beepabpo.com");
    await page.goto("/app/my/requests");
    await expect(page.getByText(/new support ticket|create ticket/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /create ticket/i }).click();
    await expect(page.locator("#subject")).toBeVisible();
    // empty subject should show client validation
    await page.locator("#subject").fill("");
    await page.getByRole("button", { name: /create ticket/i }).click();
    await expect(
      page.getByText(/required|enter a subject|subject/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
