import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("payroll period approval seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/payroll/actions.ts"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );
  const detail = readFileSync(
    join(process.cwd(), "app/app/payroll/periods/[id]/page.tsx"),
    "utf8",
  );
  const approvals = readFileSync(
    join(process.cwd(), "app/app/approvals/page.tsx"),
    "utf8",
  );
  const seed = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260906000600_seed_roles_permissions.sql",
    ),
    "utf8",
  );

  it("wires submit + review through payroll workflow code", () => {
    expect(actions).toContain("export async function submitPayrollPeriodForApproval");
    expect(actions).toContain("export async function reviewPayrollPeriod");
    expect(actions).toContain('workflowCode: "payroll"');
    expect(actions).toContain('entityType: "payroll_period"');
    expect(actions).toContain("advanceApprovalRequest");
    expect(actions).toContain('status: "finalized"');
    expect(validation).toContain("export const payrollPeriodReviewSchema");
  });

  it("seeded payroll workflow is Finance then Owner", () => {
    expect(seed).toContain("'payroll', 'Payroll approval', 'payroll_period'");
    expect(seed).toContain("'finance', 'payroll.manage', 'Finance'");
    expect(seed).toContain("'owner', 'payroll.approve', 'Owner'");
  });

  it("detail UI and approvals deep-link payroll periods", () => {
    expect(detail).toContain("SubmitPayrollApprovalButton");
    expect(detail).toContain("PayrollPeriodReviewButtons");
    expect(detail).toContain("mapPendingApprovalActability");
    expect(approvals).toContain("payroll_period");
    expect(approvals).toContain("/app/payroll/periods/");
  });
});
