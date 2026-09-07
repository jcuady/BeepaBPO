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
