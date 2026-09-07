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
    expect(corrections).toContain("ATTENDANCE_CORRECTION_WORKFLOW_ID");
    expect(corrections).toContain('entity_type: "attendance_correction"');
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
