import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("client timesheet approval seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/attendance/client-timesheet.ts"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );
  const timesheets = readFileSync(
    join(process.cwd(), "app/app/client/timesheets/page.tsx"),
    "utf8",
  );
  const approvals = readFileSync(
    join(process.cwd(), "app/app/client/approvals/page.tsx"),
    "utf8",
  );
  const attendance = readFileSync(
    join(process.cwd(), "app/app/attendance/page.tsx"),
    "utf8",
  );
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260907180000_client_timesheet_approval.sql",
    ),
    "utf8",
  );

  it("exports review + submit actions with zod gates", () => {
    expect(actions).toContain("export async function reviewClientTimesheet");
    expect(actions).toContain(
      "export async function submitTimesheetForClientReview",
    );
    expect(validation).toContain("clientTimesheetReviewSchema");
    expect(actions).toContain('approval_status !== "client_review"');
    expect(actions).toContain('"finalized"');
    expect(actions).toContain('"supervisor_review"');
  });

  it("client UI wires Approve/Send back for client_review rows", () => {
    expect(timesheets).toContain("ClientTimesheetReviewActions");
    expect(timesheets).toContain('eq("approval_status", "client_review")');
    expect(approvals).toContain("ClientTimesheetReviewActions");
    expect(approvals).toContain("attendance_record_id");
  });

  it("internal attendance can submit to client review", () => {
    expect(attendance).toContain("SubmitForClientReviewButton");
    expect(attendance).toContain("approval_status");
  });

  it("migration exposes attendance_record_id on summary view", () => {
    expect(migration).toContain("ar.id as attendance_record_id");
    expect(migration).toContain("allow_timesheet_approval = true");
  });
});
