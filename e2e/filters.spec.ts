import { expect, test, type Page } from "@playwright/test";
import { fillStable } from "./fixtures";

const password = process.env.DEMO_PASSWORD;

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required for filter e2e tests");
});

async function employeeLogin(page: Page, email: string) {
  await page.goto("/employee/login");
  await fillStable(page.getByLabel(/email/i), email);
  await fillStable(page.getByLabel(/^password$/i), password!);
  await page.getByRole("button", { name: /access portal/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000, waitUntil: "domcontentloaded" });
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

  /**
   * The other four tests assert the URL changed. That is not the same as
   * asserting the list changed, and the difference is exactly where the
   * `/app/admin/users` bug lived: the page read `stringParam(params.role)` and
   * rendered the control, so the URL updated correctly while the query behind
   * it did not narrow. A URL assertion alone would have shipped it green.
   */
  test("admin role filter actually narrows the rows", async ({ page }) => {
    await employeeLogin(page, "owner@demo.beepabpo.com");
    await page.goto("/app/admin/users");
    // Text, not `getByRole("heading")`: `CardTitle` renders a plain <div>, as
    // shadcn's does, so there is no heading landmark to match. The first
    // draft of this test asked for a heading and failed against a correct page.
    await expect(page.getByText(/invite internal user/i)).toBeVisible({
      timeout: 15_000,
    });

    const rolesCell = page.locator("tbody tr td:nth-child(3)");
    const unfiltered = await rolesCell.allInnerTexts();

    // Pick a real option off the control rather than hardcoding a role code —
    // the option list is read from the `roles` table and can change.
    const roleSelect = page.locator('select[name="role"]');
    const options = await roleSelect.locator("option").evaluateAll((els) =>
      els
        .map((e) => ({ value: (e as HTMLOptionElement).value, label: (e as HTMLOptionElement).textContent?.trim() ?? "" }))
        .filter((o) => o.value !== ""),
    );
    expect(options.length).toBeGreaterThan(0);

    // A role that is unlikely to match everyone, so "narrowed" is observable.
    const target = options[options.length - 1];
    await roleSelect.selectOption(target.value);
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page).toHaveURL(new RegExp(`role=${target.value}`));

    await expect(roleSelect).toHaveValue(target.value);

    const filtered = await rolesCell.allInnerTexts();
    // Either nothing matches, or everything shown holds the chosen role.
    // A page that ignored the filter would return the unfiltered rows verbatim.
    for (const cell of filtered) {
      expect(cell).toContain(target.label);
    }
    expect(filtered).not.toEqual(unfiltered);
  });

  test("admin search and role filter compose", async ({ page }) => {
    // The two narrowing paths meet in one query: text search resolves to
    // profile/org ids and ANDs them with the role's membership ids. A single
    // `.or()` cannot express "role X AND name Y", which is why the role filter
    // constrains `id` rather than joining inline.
    await employeeLogin(page, "owner@demo.beepabpo.com");
    await page.goto("/app/admin/users?q=a&role=owner");
    await expect(page.getByText(/invite internal user/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('select[name="role"]')).toHaveValue("owner");

    const cells = await page.locator("tbody tr td:nth-child(3)").allInnerTexts();
    for (const cell of cells) expect(cell).toContain("Owner");
  });
});
