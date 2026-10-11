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

  it("the view hides days outside the assignment window", () => {
    // The mechanism the submit-side guard defends against. Asserted here as well as in
    // the action, because the guard is only correct while this holds: if someone ever
    // widens the view to include out-of-window days, the guard becomes an unnecessary
    // restriction and this assertion is what will say so.
    expect(migration).toContain("ar.work_date >= ea.start_date");
    expect(migration).toContain("ar.work_date <= ea.end_date");
  });

  it("submit refuses a day the client could never see", () => {
    // A record outside the assignment window is absent from
    // public.client_attendance_summary, and both client review queues read that view
    // filtering only on approval_status. Without this check the record still reaches
    // `client_review` and never appears on the client's side.
    expect(actions).toContain("work_date, approval_status");
    expect(actions).toContain("client_organization_id, start_date, end_date");
    expect(actions).toMatch(/workDate < startDate/);
    expect(actions).toMatch(/workDate > endDate/);
    expect(actions).toContain("so the client would never see it");
  });

  it("the guard refuses rather than silently dropping, and runs before the update", () => {
    // Order matters: the window check must precede the write to `client_review`, or a
    // rejected day would still be left sitting in the client's queue.
    const body = actions.slice(
      actions.indexOf("export async function submitTimesheetForClientReview"),
    );
    const guardAt = body.indexOf("so the client would never see it");
    const updateAt = body.indexOf('update({ approval_status: "client_review" })');
    expect(guardAt, "window guard not found").toBeGreaterThan(-1);
    expect(updateAt, "status update not found").toBeGreaterThan(-1);
    expect(guardAt, "the guard must run before the record is submitted").toBeLessThan(updateAt);
  });
});
