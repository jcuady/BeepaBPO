import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("attendance correction review seam", () => {
  const corrections = readFileSync(
    join(process.cwd(), "lib/attendance/corrections.ts"),
    "utf8",
  );
  const approvals = readFileSync(
    join(process.cwd(), "app/app/approvals/page.tsx"),
    "utf8",
  );

  it("queues approval_requests on create", () => {
    expect(corrections).toContain('workflowCode: "attendance_correction"');
    expect(corrections).toContain("createApprovalRequest");
    expect(corrections).toContain('entityType: "attendance_correction"');
  });

  it("exports reviewAttendanceCorrection", () => {
    expect(corrections).toContain(
      "export async function reviewAttendanceCorrection",
    );
  });

  it("Approvals deep-links to corrections queue", () => {
    expect(approvals).toContain('href: "/app/attendance/corrections"');
    expect(approvals).not.toContain("Review UI coming later");
  });
});
