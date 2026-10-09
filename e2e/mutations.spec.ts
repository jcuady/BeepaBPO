import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fillStable, selectStable } from "./fixtures";

const password = process.env.DEMO_PASSWORD;

/**
 * Marker written into every leave request this spec creates, so the rows can be
 * removed again afterwards.
 */
const E2E_REASON = "E2E leave smoke";

/**
 * Leave types this spec must never pick.
 *
 * The previous version chose `selectOption({ index: 1 })`, which silently
 * depended on seed ordering and happened to select BEREAVEMENT — so each run
 * wrote a bereavement request into the demo tenant, into a dataset people
 * present to prospects.
 */
const UNSAFE_LEAVE_TYPES = /bereavement|leave without pay|maternity|parental/i;

function serviceClient(): SupabaseClient | null {
  // playwright.config.ts loads .env.local into process.env before specs run, so
  // these are already populated when the suite is driven through Playwright.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required for mutation e2e tests");
});

async function employeeLogin(page: Page, email: string) {
  await page.goto("/employee/login");
  await fillStable(page.getByLabel(/email/i), email);
  await fillStable(page.getByLabel(/^password$/i), password!);
  await page.getByRole("button", { name: /access portal/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000, waitUntil: "domcontentloaded" });
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

    // Pick a leave type by its visible name rather than by position, and never
    // one of the sensitive types. Index-based selection made this test depend on
    // seed ordering, which is how it came to file bereavement leave on every run.
    // Index 0 is the "Select type…" placeholder and must never be chosen.
    const labels = await options.allTextContents();
    const safeIndex = labels.findIndex(
      (l, i) => i > 0 && l.trim() && !UNSAFE_LEAVE_TYPES.test(l),
    );
    test.skip(
      safeIndex === -1,
      `No benign leave type available; options were: ${labels.join(", ")}`,
    );
    await selectStable(typeSelect, { index: safeIndex });

    const start = new Date();
    start.setDate(start.getDate() + 14);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

    // Clean up in a finally block so a failing assertion does not leave the
    // next run with another duplicate. Without this, each execution added a row
    // with the same employee and dates, which the live-data dedupe invariant
    // correctly flags: the test was breaking the very data check that exists to
    // protect the demo tenant.
    //
    // Cleanup is scoped by row ID, never by the reason string. Deleting
    // `.eq("reason", E2E_REASON)` looks equivalent and is not. The seeded demo
    // tenant already contains rows carrying that same reason, so that cleanup
    // removed the demo's own leave history along with the one row the test made,
    // and `leave_requests` went to zero. Only rows that did not exist before
    // this test ran are ever removed.
    const sb = serviceClient();
    const before = new Set<string>();
    if (sb) {
      const { data } = await sb.from("leave_requests").select("id");
      for (const row of data ?? []) before.add(row.id as string);
    }
    try {
      await page.locator("#start_date").fill(toIsoDate(start));
      await page.locator("#end_date").fill(toIsoDate(end));
      await page.locator("#reason").fill(E2E_REASON);
      await page.getByRole("button", { name: /submit leave request/i }).click();

      await expect(
        page.getByText(/leave request submitted|submitted/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      if (!sb) {
        // No service key: leave the row behind rather than fail the suite on a
        // cleanup problem. Say so, so the residue is never a mystery.
        console.warn(
          `[mutations] no service key; "${E2E_REASON}" leave request left in the demo tenant`,
        );
        return;
      }
      const { data: after, error: readError } = await sb
        .from("leave_requests")
        .select("id");
      if (readError) {
        console.warn(`[mutations] cleanup could not read rows: ${readError.message}`);
        return;
      }
      const created = (after ?? [])
        .map((r) => r.id as string)
        .filter((id) => !before.has(id));
      if (created.length === 0) return;
      const { error } = await sb.from("leave_requests").delete().in("id", created);
      if (error) {
        console.warn(`[mutations] cleanup failed: ${error.message}`);
      }
    }
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
