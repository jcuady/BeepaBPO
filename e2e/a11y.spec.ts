import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const password = process.env.DEMO_PASSWORD;

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required for a11y e2e tests");
});

async function loginEmployee(page: import("@playwright/test").Page, email: string) {
  await page.goto("/employee/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password!);
  await page.getByRole("button", { name: /access portal/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

async function loginClient(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

async function assertNoSerious(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test("login page a11y", async ({ page }) => {
  await page.goto("/login");
  await assertNoSerious(page);
});

test("employee home a11y", async ({ page }) => {
  await loginEmployee(page, "employee@demo.beepabpo.com");
  await page.goto("/app/my");
  await assertNoSerious(page);
});

test("client home a11y", async ({ page }) => {
  await loginClient(page, "clientadmin@demo.beepabpo.com");
  await page.goto("/app/client");
  await assertNoSerious(page);
});

test("dashboard a11y", async ({ page }) => {
  await loginEmployee(page, "owner@demo.beepabpo.com");
  await page.goto("/app/dashboard");
  await assertNoSerious(page);
});

test("applicant home a11y", async ({ page }) => {
  await loginClient(page, "applicant@demo.beepabpo.com");
  await page.goto("/app/applicant");
  await assertNoSerious(page);
});
