import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("demo login autofill seam", () => {
  const users = readFileSync(
    join(process.cwd(), "lib/demo/users.ts"),
    "utf8",
  );
  const loginHelper = readFileSync(
    join(process.cwd(), "lib/demo/login.ts"),
    "utf8",
  );
  const picker = readFileSync(
    join(process.cwd(), "components/auth/demo-login-picker.tsx"),
    "utf8",
  );
  const clientLogin = readFileSync(
    join(process.cwd(), "components/auth/login-form.tsx"),
    "utf8",
  );
  const employeeLogin = readFileSync(
    join(process.cwd(), "components/auth/employee-login-form.tsx"),
    "utf8",
  );
  const seed = readFileSync(
    join(process.cwd(), "scripts/seed-demo.mts"),
    "utf8",
  );

  it("catalog includes all 13 demo roles", () => {
    expect(users).toContain("owner@demo.beepabpo.com");
    expect(users).toContain("clientadmin@demo.beepabpo.com");
    expect(users).toContain("applicant@demo.beepabpo.com");
    expect(users.match(/@demo\.beepabpo\.com/g)?.length).toBe(13);
  });

  it("gates picker on DEMO_PASSWORD and non-prod / ALLOW_DEMO_LOGIN", () => {
    expect(loginHelper).toContain("DEMO_PASSWORD");
    expect(loginHelper).toContain('ALLOW_DEMO_LOGIN === "true"');
    expect(loginHelper).toContain('NODE_ENV === "production"');
  });

  it("both login forms wire DemoLoginPicker autofill", () => {
    expect(clientLogin).toContain("DemoLoginPicker");
    expect(employeeLogin).toContain("DemoLoginPicker");
    expect(picker).toContain("data-testid=\"demo-login-picker\"");
    expect(picker).toContain("onFill");
  });

  it("seed syncs existing Supabase Auth passwords", () => {
    expect(seed).toContain("updateUserById");
    expect(seed).toContain("password");
  });
});
