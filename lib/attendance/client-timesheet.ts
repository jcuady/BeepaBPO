"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { can, canAny } from "@/lib/permissions/can";
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
  if (workspace.isClient) {
    return {
      ok: false,
      error: "Client users cannot submit timesheets into the review queue.",
    };
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
    .select("id, employee_id, approval_status")
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
    .select("client_organization_id")
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

  revalidateClientTimesheetPaths();
  return { ok: true, message: "Timesheet submitted for client review." };
}
