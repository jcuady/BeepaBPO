import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("hire convert seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/recruitment/actions.ts"),
    "utf8",
  );
  const page = readFileSync(
    join(process.cwd(), "app/app/recruitment/applicants/[id]/page.tsx"),
    "utf8",
  );

  it("exports convertApplicantToEmployee", () => {
    expect(actions).toContain(
      "export async function convertApplicantToEmployee",
    );
  });

  it("requires recruitment.manage and employees.manage", () => {
    const start = actions.indexOf(
      "export async function convertApplicantToEmployee",
    );
    const body = actions.slice(start, start + 800);
    expect(body).toContain('"recruitment.manage"');
    expect(body).toContain('"employees.manage"');
    expect(body).toContain("canAll");
  });

  it("invites via admin auth and creates employees row", () => {
    expect(actions).toContain("inviteOrResolveAuthUser");
    expect(actions).toContain('from("employees")');
    expect(actions).toContain('membership_type: "internal"');
  });

  it("applicant detail wires HireConvertButton", () => {
    expect(page).toContain("HireConvertButton");
    expect(page).toContain("canHire");
  });
});

/**
 * The hire path shared the invite ordering defect with `inviteClientUser` and
 * `inviteInternalUser`, and is the third call site of the same helper.
 *
 * The risk here is higher than in the other two: an applicant who already has a
 * `profile_id` is returned with `invited: false`, so any rollback that is not
 * gated on `invited === true` would delete the profile of somebody who was
 * already in the system.
 */
describe("hire invite ordering and rollback", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/recruitment/actions.ts"),
    "utf8",
  );
  const start = actions.indexOf(
    "export async function convertApplicantToEmployee",
  );
  const body = actions.slice(start);

  it("resolves the employee role before taking any irreversible action", () => {
    const roleLookup = body.indexOf('from("roles")');
    const invite = body.indexOf("await inviteOrResolveAuthUser(");
    expect(roleLookup).toBeGreaterThan(-1);
    expect(invite).toBeGreaterThan(-1);
    expect(roleLookup).toBeLessThan(invite);
  });

  it("looks the role up exactly once", () => {
    // The duplicate was the reason the fix had to be applied twice by hand.
    expect(body.match(/from\("roles"\)/g) ?? []).toHaveLength(1);
  });

  it("rolls back an account it created when provisioning fails after the invite", () => {
    expect(body).toContain("deleteUser");
    expect(body).toMatch(/invited\s*===\s*true/);
    expect(body).not.toMatch(/if\s*\(\s*!invited\s*\)/);
  });

  it("checks the two updates whose results it used to discard", () => {
    expect(body).toMatch(
      /const\s*\{\s*error:\s*applicantLinkError\s*\}\s*=\s*await\s*admin\s*\.from\("applicants"\)\s*\.update\(/,
    );
    expect(body).toMatch(
      /const\s*\{\s*error:\s*profileError\s*\}\s*=\s*await\s*admin\s*\.from\("profiles"\)\s*\.update\(/,
    );
  });

  it("does not surface raw provider error strings", () => {
    expect(body).not.toMatch(/error:\s*membershipError\?\.message/);
    expect(body).not.toMatch(/error:\s*roleError\.message/);
  });
});
