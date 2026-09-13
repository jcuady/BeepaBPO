import { expect, test, type Page } from "@playwright/test";

/**
 * Viewport matrix: marketing + auth shells at phone → desktop widths.
 * Checks no horizontal page overflow (common mobile break).
 */

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1920", width: 1920, height: 1080 },
] as const;

const PUBLIC_PATHS = ["/", "/why-beepa", "/services", "/login", "/employee/login"] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const path of PUBLIC_PATHS) {
      test(`${path} has no horizontal overflow`, async ({ page }) => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
        await assertNoHorizontalOverflow(page);
      });
    }
  });
}

test.describe("app shell viewports (authenticated)", () => {
  const password = process.env.DEMO_PASSWORD;
  test.beforeAll(() => {
    test.skip(!password, "DEMO_PASSWORD required for app shell viewport checks");
  });

  for (const vp of [
    { name: "375", width: 375, height: 812 },
    { name: "1280", width: 1280, height: 800 },
  ] as const) {
    test(`employee my workspace @ ${vp.name}`, async ({ page }) => {
      test.skip(!password);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/employee/login");
      await page.getByLabel(/email/i).fill("employee@demo.beepabpo.com");
      await page.getByLabel(/^password$/i).fill(password!);
      await page.getByRole("button", { name: /access portal/i }).click();
      await page.waitForURL(/\/app\/my/, { timeout: 30_000 });
      await assertNoHorizontalOverflow(page);

      await page.goto("/app/my/leave");
      await expect(page.locator("body")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });

    test(`client portal @ ${vp.name}`, async ({ page }) => {
      test.skip(!password);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login");
      await page.getByLabel(/email/i).fill("clientadmin@demo.beepabpo.com");
      await page.getByLabel(/^password$/i).fill(password!);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/app\/client/, { timeout: 30_000 });
      await assertNoHorizontalOverflow(page);

      await page.goto("/app/client/team");
      await expect(page.locator("body")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
});
