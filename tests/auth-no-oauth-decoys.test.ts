import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trust: email/password is the supported auth path.
 * Do not show social OAuth CTAs while OAuth is deferred (no decoy buttons).
 */
describe("auth forms have no decoy OAuth CTAs", () => {
  const login = readFileSync(
    join(process.cwd(), "components/auth/login-form.tsx"),
    "utf8",
  );
  const signup = readFileSync(
    join(process.cwd(), "components/auth/signup-form.tsx"),
    "utf8",
  );
  const employee = readFileSync(
    join(process.cwd(), "components/auth/employee-login-form.tsx"),
    "utf8",
  );

  it("login has no Google CTA", () => {
    expect(login).not.toContain("Continue with Google");
    expect(login).not.toContain("IconBrandGoogleFilled");
  });

  it("signup has no Google CTA", () => {
    expect(signup).not.toContain("Continue with Google");
    expect(signup).not.toContain("IconBrandGoogleFilled");
  });

  it("employee login has no Microsoft CTA", () => {
    expect(employee).not.toContain("Continue with Microsoft");
    expect(employee).not.toContain("IconBrandWindows");
  });
});
