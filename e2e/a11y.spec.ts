import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { applyStoredSession } from "./fixtures";

/**
 * Map a demo email to the storage-state key auth.setup.ts persists for it.
 *
 * These tests audit rendered pages, not the sign-in flow, so they adopt the
 * session rather than spending a rate-limited password grant per test. This
 * spec previously performed 12 sign-ins on every run.
 */
const ROLE_BY_EMAIL: Record<string, string> = {
  "employee@demo.beepabpo.com": "employee",
  "owner@demo.beepabpo.com": "owner",
  "hr@demo.beepabpo.com": "hr",
  "marketing@demo.beepabpo.com": "marketing",
  "clientadmin@demo.beepabpo.com": "clientadmin",
  "applicant@demo.beepabpo.com": "applicant",
};

async function loginEmployee(page: import("@playwright/test").Page, email: string) {
  await applyStoredSession(page, ROLE_BY_EMAIL[email]);
}

async function loginClient(page: import("@playwright/test").Page, email: string) {
  await applyStoredSession(page, ROLE_BY_EMAIL[email]);
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

/**
 * Card titles must be real headings.
 *
 * `CardTitle` rendered a `<div>`, so every card title in the app was invisible
 * to heading navigation. axe never flagged it: a `<div>` is not a *broken*
 * heading, it is simply not one, so the check has to be positive — assert the
 * heading role is there, rather than trusting a scanner to notice its absence.
 *
 * This is the exact locator that failed against a correct-looking page and
 * started the investigation. Turning it into an assertion means the same class
 * of regression cannot come back silently.
 */
test("card titles are exposed as headings", async ({ page }) => {
  await loginEmployee(page, "owner@demo.beepabpo.com");
  await page.goto("/app/admin/users");

  // PageHeader is the page <h1>; the card title must be a heading beneath it.
  await expect(page.getByRole("heading", { name: /invite internal user/i })).toBeVisible({
    timeout: 15_000,
  });
  const level = await page
    .getByRole("heading", { name: /invite internal user/i })
    .evaluate((el) => el.tagName);
  expect(level).toBe("H2");

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

// The notification pages carry the preference Switches, whose hit area is an
// ::after overlay rather than the painted box. axe measures the painted box,
// so these pages are the ones most likely to regress from a switch change —
// and they were previously not covered at all.

test("employee notifications a11y", async ({ page }) => {
  await loginEmployee(page, "employee@demo.beepabpo.com");
  await page.goto("/app/my/notifications");
  await assertNoSerious(page);
});

test("client notifications a11y", async ({ page }) => {
  await loginClient(page, "clientadmin@demo.beepabpo.com");
  await page.goto("/app/client/notifications");
  await assertNoSerious(page);
});

// Pages that gained pagers this session, plus the one page whose typography
// changed everywhere.
//
// `/app/approvals` and `/app/client/timesheets` each gained a `ListPager` — a
// `<nav aria-label="Pagination">` with Prev/Next links, which is exactly the kind
// of new landmark that axe should be re-run against rather than assumed safe.
// `/app/cms` gained six of them at once.
//
// `/app/cms` needs the marketing account: owner has no `cms.manage`, so testing
// it as owner would assert against the forbidden page and prove nothing.

test("approvals queue a11y", async ({ page }) => {
  await loginEmployee(page, "owner@demo.beepabpo.com");
  await page.goto("/app/approvals");
  await assertNoSerious(page);
});

test("client timesheets a11y", async ({ page }) => {
  await loginClient(page, "clientadmin@demo.beepabpo.com");
  await page.goto("/app/client/timesheets");
  await assertNoSerious(page);
});

test("cms admin a11y", async ({ page }) => {
  await loginEmployee(page, "marketing@demo.beepabpo.com");
  await page.goto("/app/cms");
  await assertNoSerious(page);
});

// Note on coverage: with the seeded demo data (7 FAQs, 5 blog posts, and so on)
// none of these pagers actually *render* — `ListPager` returns null until a page
// is full. So these three tests prove the pages still pass axe after the change,
// not that a rendered pager does. The pager markup itself is shared with the 27
// other list pages that do render it, and `tests/list-pagination.test.ts` pins the
// wiring. Verifying a *rendered* pager would need >50 rows in a content table,
// which is not something to create just to satisfy a test.
test("notification switches are keyboard operable and labelled", async ({ page }) => {
  await loginEmployee(page, "employee@demo.beepabpo.com");
  await page.goto("/app/my/notifications");

  const switches = page.getByRole("switch");
  // count() does not auto-wait; the page hydrates after domcontentloaded.
  await expect(switches.first()).toBeVisible();
  await expect(switches).toHaveCount(3);

  const count = await switches.count();
  for (let i = 0; i < count; i += 1) {
    const sw = switches.nth(i);
    // Every control needs an accessible name, or a screen reader announces
    // an unlabelled toggle (axe: aria-toggle-field-name, WCAG 4.1.2).
    const name = (await sw.getAttribute("aria-label")) ?? "";
    expect(name.trim().length).toBeGreaterThan(0);

    // Focusable: a mouse-only switch is not accessible.
    await sw.focus();
    expect(await sw.evaluate((el) => el === document.activeElement)).toBe(true);
    expect(await sw.getAttribute("aria-checked")).toMatch(/^(true|false)$/);
  }
});

// `pointer: coarse` is what the switch's 44px target actually depends on, and
// emulating it needs BOTH `hasTouch` and `isMobile`.
//
// `hasTouch: true` alone was not enough: it enables touch *events* but leaves
// `pointer` fine, so the switch's `[@media(pointer:coarse)]:after:-inset-y-[15px]`
// never applied and the check measured 24x30 instead of 48x44. The test was
// asserting a coarse-pointer rule under a fine-pointer browser, which means it
// could not pass — it was reported green in the ledger at a time when the
// preference switches were not yet on this page, and started failing the moment
// they were. `isMobile` is what makes Chromium's primary pointer coarse.
test.describe("notification switches on a touch device", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("meet the 44px touch target", async ({ page }) => {
    await loginEmployee(page, "employee@demo.beepabpo.com");
    await page.goto("/app/my/notifications");
    await expect(page.getByRole("switch").first()).toBeVisible();

    const tooSmall = await page.evaluate(() => {
      const MIN = 44;
      const bad: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('[role="switch"]')) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;

        // The tappable area is the ::after overlay, not the painted switch.
        const after = getComputedStyle(el, "::after");
        const rect = el.getBoundingClientRect();
        let h = rect.height;
        let w = rect.width;
        if (after && after.content !== "none" && after.position === "absolute") {
          const n = (v: string) => (v && v !== "auto" ? parseFloat(v) : 0);
          h += Math.max(-n(after.top), -n(after.bottom), 0) * 2;
          w += Math.max(-n(after.left), -n(after.right), 0) * 2;
        }
        if (h < MIN || w < MIN) {
          bad.push(`${el.getAttribute("aria-label")} ${Math.round(w)}x${Math.round(h)}`);
        }
      }
      return bad;
    });

    expect(tooSmall, "switches below the 44px touch minimum").toEqual([]);
  });
});
