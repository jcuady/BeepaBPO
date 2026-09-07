import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dynamic approval workflows seam", () => {
  const engine = readFileSync(
    join(process.cwd(), "lib/approvals/engine.ts"),
    "utf8",
  );
  const leave = readFileSync(
    join(process.cwd(), "lib/leave/actions.ts"),
    "utf8",
  );
  const cash = readFileSync(
    join(process.cwd(), "lib/cash-advance/actions.ts"),
    "utf8",
  );
  const attendance = readFileSync(
    join(process.cwd(), "lib/attendance/corrections.ts"),
    "utf8",
  );
  const adminPage = readFileSync(
    join(process.cwd(), "app/app/admin/workflows/page.tsx"),
    "utf8",
  );
  const nav = readFileSync(
    join(process.cwd(), "lib/app/navigation.ts"),
    "utf8",
  );

  it("resolves workflows by code and advances steps", () => {
    expect(engine).toContain("export async function resolveActiveWorkflow");
    expect(engine).toContain("export async function createApprovalRequest");
    expect(engine).toContain("export async function advanceApprovalRequest");
    expect(engine).toContain("canActOnApprovalStep");
    expect(engine).toContain('eq("code", code)');
  });

  it("leave/cash/attendance use engine instead of hardcoded UUIDs", () => {
    expect(leave).toContain('workflowCode: "leave"');
    expect(leave).toContain("advanceApprovalRequest");
    expect(leave).not.toContain("LEAVE_WORKFLOW_ID");
    expect(cash).toContain('workflowCode: "cash_advance"');
    expect(cash).toContain("advanceApprovalRequest");
    expect(cash).not.toContain("CASH_ADVANCE_WORKFLOW_ID");
    expect(attendance).toContain('workflowCode: "attendance_correction"');
    expect(attendance).not.toContain("ATTENDANCE_CORRECTION_WORKFLOW_ID");
  });

  it("admin workflows page is linked", () => {
    expect(adminPage).toContain("approval_workflows");
    expect(adminPage).toContain("approval_steps");
    expect(nav).toContain('href: "/app/admin/workflows"');
  });
});
