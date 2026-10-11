"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { can, canAny } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clientTimesheetReviewSchema,
  submitTimesheetForClientReviewSchema,
} from "@/lib/validation/app";

function revalidateClientTimesheetPaths() {
  revalidatePath("/app/client");
  revalidatePath("/app/client/timesheets");
  revalidatePath("/app/client/approvals");
  revalidatePath("/app/client/attendance");
  revalidatePath("/app/attendance");
}

async function assertClientTimesheetApprovalEnabled(
  clientOrgId: string,
): Promise<ActionResult | null> {
  // ponytail: admin read — internal submitters may lack client_settings SELECT RLS
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("client_settings")
    .select("allow_timesheet_approval")
    .eq("client_organization_id", clientOrgId)
    .maybeSingle();

  if (!settings?.allow_timesheet_approval) {
    return {
      ok: false,
      error: "Timesheet approval is not enabled for this organization.",
    };
  }
  return null;
}

export async function reviewClientTimesheet(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isClient) {
    return { ok: false, error: "Only client users can review these timesheets." };
  }
  if (
    !can(workspace.permissions, "attendance.approve") ||
    !can(workspace.permissions, "approvals.act")
  ) {
    return {
      ok: false,
      error: "You do not have permission to approve timesheets.",
    };
  }

  const parsed = clientTimesheetReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid timesheet review request.",
    };
  }

  const clientOrgId = getClientOrganizationId(workspace);
  if (!clientOrgId) {
    return { ok: false, error: "No client organization linked to your account." };
  }

  const settingsError = await assertClientTimesheetApprovalEnabled(clientOrgId);
  if (settingsError) return settingsError;

  // ponytail: admin client after authz — clients lack attendance_records UPDATE RLS
  const admin = createAdminClient();
  const { data: record } = await admin
    .from("attendance_records")
    .select("id, employee_id, approval_status")
    .eq("id", parsed.data.attendance_record_id)
    .maybeSingle();

  if (!record) {
    return { ok: false, error: "Timesheet day not found." };
  }

  const { data: assigned } = await admin
    .from("employee_assignments")
    .select("id")
    .eq("employee_id", record.employee_id)
    .eq("client_organization_id", clientOrgId)
    .eq("assignment_type", "client")
    .eq("status", "active")
    .maybeSingle();

  if (!assigned) {
    return {
      ok: false,
      error: "This timesheet is not for your organization's assigned team.",
    };
  }

  if (record.approval_status !== "client_review") {
    return {
      ok: false,
      error: "This timesheet is not awaiting client review.",
    };
  }

  const nextStatus =
    parsed.data.action === "approve" ? "finalized" : "supervisor_review";

  const { error } = await admin
    .from("attendance_records")
    .update({ approval_status: nextStatus })
    .eq("id", record.id)
    .eq("approval_status", "client_review");

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update timesheet." };
  }

  // The other half of the same gap. The client's decision is the one an attendance dispute
  // is actually about -- "our client approved this day" -- so leaving it unrecorded is the
  // worse half of the omission. `entityType` stays `attendance_record` so both sides of the
  // hand-off are queryable from the one record.
  await logAudit(admin, {
    actorUserId: workspace.user.id,
    organizationId: clientOrgId,
    action:
      parsed.data.action === "approve"
        ? "attendance.client_review.approve"
        : "attendance.client_review.send_back",
    entityType: "attendance_record",
    entityId: record.id,
    before: { approval_status: "client_review" },
    after: { approval_status: nextStatus },
  });

  revalidateClientTimesheetPaths();
  return {
    ok: true,
    message:
      parsed.data.action === "approve"
        ? "Timesheet approved."
        : "Timesheet sent back to Beepa for revision.",
  };
}

export async function submitTimesheetForClientReview(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (workspace.isClient && !workspace.isInternal) {
    return {
      ok: false,
      error: "Client users cannot submit timesheets into the review queue.",
    };
  }
  if (!workspace.isInternal) {
    return { ok: false, error: "Staff access required." };
  }
  if (
    !canAny(workspace.permissions, [
      "attendance.approve",
      "attendance.manage",
      "attendance.correct",
    ])
  ) {
    return {
      ok: false,
      error: "You do not have permission to submit timesheets for client review.",
    };
  }

  const parsed = submitTimesheetForClientReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid submit request.",
    };
  }

  const admin = createAdminClient();
  const { data: record } = await admin
    .from("attendance_records")
    .select("id, employee_id, work_date, approval_status")
    .eq("id", parsed.data.attendance_record_id)
    .maybeSingle();

  if (!record) {
    return { ok: false, error: "Attendance record not found." };
  }

  if (
    record.approval_status === "client_review" ||
    record.approval_status === "finalized"
  ) {
    return {
      ok: false,
      error: "This timesheet is already in client review or finalized.",
    };
  }

  const { data: assignment } = await admin
    .from("employee_assignments")
    .select("client_organization_id, start_date, end_date")
    .eq("employee_id", record.employee_id)
    .eq("assignment_type", "client")
    .eq("status", "active")
    .not("client_organization_id", "is", null)
    .maybeSingle();

  if (!assignment?.client_organization_id) {
    return {
      ok: false,
      error: "Employee has no active client assignment.",
    };
  }

  // The client never sees a day outside the assignment window, and the reason is in
  // the view rather than in either page: public.client_attendance_summary filters
  //   and (ea.start_date is null or ar.work_date >= ea.start_date)
  //   and (ea.end_date   is null or ar.work_date <= ea.end_date)
  // so a record outside the window is absent from the view entirely. Both client
  // review queues read that view and filter only on approval_status, so without this
  // check the record still reaches `client_review` and simply never appears on the
  // client's side: Beepa shows "submitted", the client's queue is empty, and nothing
  // anywhere says why. A timesheet day vanishes silently between two organisations.
  //
  // Refusing here is the fix the owner chose: the submit is where the information to
  // prevent it exists, and failing loudly at submission is recoverable in a way that
  // a silent hand-off is not.
  const workDate = record.work_date;
  if (workDate) {
    const { start_date: startDate, end_date: endDate } = assignment;
    if (startDate && workDate < startDate) {
      return {
        ok: false,
        error: `This day (${workDate}) falls before the employee's client assignment starts (${startDate}), so the client would never see it. Correct the attendance date or the assignment first.`,
      };
    }
    if (endDate && workDate > endDate) {
      return {
        ok: false,
        error: `This day (${workDate}) falls after the employee's client assignment ended (${endDate}), so the client would never see it. Correct the attendance date or the assignment first.`,
      };
    }
  }

  const settingsError = await assertClientTimesheetApprovalEnabled(
    assignment.client_organization_id,
  );
  if (settingsError) return settingsError;

  const { error } = await admin
    .from("attendance_records")
    .update({ approval_status: "client_review" })
    .eq("id", record.id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to submit for review." };
  }

  // This hand-off and the client's decision on the far side are the two moments a
  // timesheet day stops being Beepa's problem and becomes the client's — and neither
  // wrote an audit row. So the repo could not answer "who sent this, and when" or "who
  // approved this day", which is exactly the question an attendance dispute asks.
  // Recorded as an open finding by the workflow exercise and left unfixed until now.
  await logAudit(admin, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "attendance.client_review.submit",
    entityType: "attendance_record",
    entityId: record.id,
    before: { approval_status: record.approval_status },
    after: { approval_status: "client_review" },
  });

  revalidateClientTimesheetPaths();
  return { ok: true, message: "Timesheet submitted for client review." };
}
