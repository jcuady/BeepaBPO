import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Authenticated specs reuse a persisted session produced by e2e/auth.setup.ts.
//
// auth.setup.ts now THROWS when DEMO_PASSWORD is missing rather than skipping,
// because a skipped dependency does not skip its dependents: the dependent
// projects used to run unauthenticated and report 14 misleading redirect
// failures. So `hasAuth` is defensive only — if credentials are absent, setup
// has already failed and this project never runs. Kept anyway so the config
// does not point `storageState` at a file that setup refused to write.
const hasAuth = Boolean(process.env.DEMO_PASSWORD);
const storageState = (role: string) =>
  hasAuth ? resolve(process.cwd(), ".auth", `${role}.json`) : undefined;

export default defineConfig({
  testDir: "./e2e",
  // The suite previously ran with `fullyParallel: false, workers: 1`, which
  // serialised every test even though they are independent. Tests that mutate
  // shared demo data opt out explicitly via test.describe.serial.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      // Specs that sign in themselves MUST run without a persisted session.
      // With a storageState applied, navigating to /login redirects straight to
      // /app, so the email/password controls are absent and every explicit-login
      // test fails at the login step.
      name: "anonymous",
      dependencies: ["setup"],
      testMatch: /(roles|demo-login|demo-ready|mutations|filters|viewport|a11y)\.spec\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testMatch: /app-smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: storageState("employee"),
      },
    },
    {
      // Owner-scoped specs run in their own project so they get the owner's
      // permissions instead of an employee's.
      name: "owner",
      dependencies: ["setup"],
      testMatch: /owner\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: storageState("owner"),
      },
    },
    {
      name: "client",
      dependencies: ["setup"],
      testMatch: /client\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: storageState("clientadmin"),
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});