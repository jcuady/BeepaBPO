import { expect, test, type Page } from "@playwright/test";

const password = process.env.DEMO_PASSWORD;

const DEMO_USERS = [
  { email: "owner@demo.beepabpo.com", login: "employee", landing: "/app/dashboard" },
  { email: "superadmin@demo.beepabpo.com", login: "employee", landing: "/app/dashboard" },
  { email: "hr@demo.beepabpo.com", login: "employee", landing: "/app/my" },
  { email: "recruiter@demo.beepabpo.com", login: "employee", landing: "/app/my" },
  { email: "sales@demo.beepabpo.com", login: "employee", landing: "/app/my" },
  { email: "marketing@demo.beepabpo.com", login: "employee", landing: "/app/my" },
  { email: "operations@demo.beepabpo.com", login: "employee", landing: "/app/my" },
  { email: "teamlead@demo.beepabpo.com", login: "employee", landing: "/app/my" },
  { email: "finance@demo.beepabpo.com", login: "employee", landing: "/app/my" },
  { email: "employee@demo.beepabpo.com", login: "employee", landing: "/app/my" },
  { email: "clientadmin@demo.beepabpo.com", login: "client", landing: "/app/client" },
  { email: "clientviewer@demo.beepabpo.com", login: "client", landing: "/app/client" },
  { email: "applicant@demo.beepabpo.com", login: "client", landing: "/app/applicant" },
] as const;

test.beforeAll(() => {
  test.skip(!password, "DEMO_PASSWORD is required for role e2e tests");
});

async function login(
  page: Page,
  email: string,
  kind: "employee" | "client",
) {
  const path = kind === "employee" ? "/employee/login" : "/login";
  await page.goto(path);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password!);
  const submit =
    kind === "employee"
      ? page.getByRole("button", { name: /access portal/i })
      : page.getByRole("button", { name: /sign in/i });
  await submit.click();
}

test.describe("demo role logins", () => {
  for (const user of DEMO_USERS) {
    test(`${user.email} lands on ${user.landing}`, async ({ page }) => {
      await login(page, user.email, user.login);
      await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
      await expect(page).toHaveURL(new RegExp(user.landing.replace(/\//g, "\\/")));
    });
  }

  test("client cannot use employee login", async ({ page }) => {
    await login(page, "clientadmin@demo.beepabpo.com", "employee");
    await expect(page.getByText(/client or applicant/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("employee cannot open client tree", async ({ page }) => {
    await login(page, "employee@demo.beepabpo.com", "employee");
    await page.waitForURL(/\/app/, { timeout: 30_000 });
    await page.goto("/app/client/team");
    await page.waitForURL(/\/app/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/app\/client\/team/);
  });

  test("client cannot open my tree", async ({ page }) => {
    await login(page, "clientadmin@demo.beepabpo.com", "client");
    await page.waitForURL(/\/app\/client/, { timeout: 30_000 });
    await page.goto("/app/my/leave");
    await page.waitForURL(/\/app/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/app\/my\/leave/);
  });

  test("open redirect via next is blocked", async ({ page }) => {
    await page.goto('/login?next=//evil.com');
    await page.getByLabel(/email/i).fill("clientadmin@demo.beepabpo.com");
    await page.getByLabel(/^password$/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app/, { timeout: 30_000 });
    expect(page.url()).toContain("localhost");
    expect(page.url()).not.toContain("evil.com");
  });
});
