import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared e2e fixtures.
 *
 * `consoleErrors` collects browser console errors and uncaught page exceptions
 * for the lifetime of the test. The previous suite had no such guard, which is
 * why a series of runtime regressions could pass CI while visible to users.
 *
 * Two categories are filtered because they are noise in this stack and are
 * asserted on deliberately elsewhere (or are simply environmental):
 *   - React DevTools nag (development builds only)
 *   - Failed to load resource for the service worker / manifest, which only
 *     occurs when the SW is not yet registered on first paint
 */

const IGNORED = [
  /Download the React DevTools/i,
  /Service Worker registration/i,
  /favicon/i,
];

export type Fixtures = {
  /** Console errors + uncaught exceptions observed during the test. */
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  // Deliberately not named `use`: Playwright passes this callback positionally,
  // and any identifier starting with "use" is treated by react-hooks as a hook
  // call outside a component, which fails lint.
  consoleErrors: async ({ page }, provide) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORED.some((re) => re.test(text))) return;
      errors.push(text);
    });

    page.on("pageerror", (err) => {
      errors.push(`[pageerror] ${err.message}`);
    });

    await provide(errors);
  },
});

export { expect };

/**
 * Assert the page produced no console errors during the test.
 * @param page the page under test
 * @param errors the array returned by the `consoleErrors` fixture
 */
export function expectNoConsoleErrors(page: Page, errors: string[]) {
  expect(
    errors,
    `console errors on ${page.url()}:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
  ).toEqual([]);
}

/** Navigate and assert the page is genuinely ready, not just present. */
export async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  // Settle the client-side render/realtime subscription before measuring or
  // asserting, without resorting to a fixed sleep.
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
}

/**
 * Fill a field and confirm the value actually stuck.
 *
 * `locator.fill()` alone is not enough on a React form. If it runs before
 * hydration finishes it sets the DOM value directly, and the subsequent
 * hydration re-renders the controlled input back to its initial state — the
 * characters vanish. Nothing errors, and the test carries on until the form is
 * submitted with an empty field.
 *
 * That is exactly what was happening, and it looked like a network problem:
 * three different specs failed with "expected /app/my, timed out" while the
 * page sat on the login form showing "Enter your work email or employee ID".
 * It only reproduced under load, because a busier machine hydrates slower.
 * A login form is the worst place for this, because a wiped field surfaces as
 * an auth failure and gets blamed on the auth provider.
 *
 * Retrying until the value reads back turns a silent race into a deterministic
 * wait. The final assertion still fails the test if the field genuinely cannot
 * be filled, so this does not mask a real problem.
 */
export async function fillStable(locator: Locator, value: string) {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await locator.fill(value);
    const stuck = await locator
      .inputValue({ timeout: 2_000 })
      .then((v) => v === value)
      .catch(() => false);
    if (stuck) return;
    // Wiped by hydration — re-focus and try again on the now-hydrated input.
    await locator.click().catch(() => {});
  }
  await expect(locator, `field never accepted the value "${value}"`).toHaveValue(value);
}

type CookieParam = Parameters<ReturnType<Page["context"]>["addCookies"]>[0];

/**
 * Adopt a session persisted by `e2e/auth.setup.ts` instead of signing in.
 *
 * Supabase rate-limits password grants per IP. This suite used to perform
 * roughly 37 of them per run, which intermittently exhausted the window: the
 * failing request came back as a rate-limit error, `employeeLoginAction`
 * reported it as "Invalid email or password.", and the affected tests timed
 * out waiting for a redirect. Which tests failed changed from run to run,
 * which is the signature of a shared, external resource rather than a bug in
 * any one spec.
 *
 * Tests that assert something *about* signing in must still sign in. Tests that
 * only need an authenticated session should call this instead: it reuses the
 * one session auth.setup already paid for.
 *
 * Cookies are injected with `addCookies` rather than a per-role
 * `test.use({ storageState })` so specs can keep a flat list of tests instead of
 * being reorganised into one describe block per role.
 */
export async function applyStoredSession(page: Page, role: string) {
  const file = resolve(process.cwd(), ".auth", `${role}.json`);
  if (!existsSync(file)) {
    throw new Error(
      `No stored session for "${role}" at ${file}. auth.setup.ts should have ` +
        `created it — run the suite through Playwright so the setup project runs.`,
    );
  }
  const state = JSON.parse(readFileSync(file, "utf8")) as { cookies?: CookieParam };
  await page.context().addCookies(state.cookies ?? []);
}

/**
 * Choose an option in a React-controlled `<select>` and confirm it stuck.
 *
 * Same hydration race as `fillStable`, and it bites harder here: a select that
 * silently reverts to its placeholder submits the form with no leave type, so
 * the app shows a validation error and the test waits for a success message
 * that can never arrive. The failure then reads as "the submit button is
 * broken" rather than "the selection was wiped".
 */
export async function selectStable(
  locator: Locator,
  option: { index: number } | { label: string } | { value: string },
) {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await locator.selectOption(option);
    // Index 0 of a placeholder-style select is "Select type…". Staying there
    // means hydration reverted the choice, which submits an empty form.
    const stuck = await locator
      .evaluate((el) => (el as HTMLSelectElement).selectedIndex !== 0)
      .catch(() => false);
    if (stuck) return;
    await locator.click().catch(() => {});
  }
  await expect(
    locator,
    `select never kept option ${JSON.stringify(option)}`,
  ).not.toHaveValue("");
}