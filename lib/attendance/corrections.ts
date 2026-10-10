"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import {
  advanceApprovalRequest,
  createApprovalRequest,
} from "@/lib/approvals/engine";
import { resolveCorrectedClockTimes, naiveDateTimeToZoned } from "@/lib/attendance/corrected-times";
import { DEFAULT_TIMEZONE } from "@/lib/attendance/zoned-time";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can, canAny } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  attendanceCorrectionReviewSchema,
  attendanceCorrectionSchema,
} from "@/lib/validation/app";

export async function createAttendanceCorrection(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "attendance.self")) {
    return {
      ok: false,
      error: "You do not have permission to request corrections.",
    };
  }

  const parsed = attendanceCorrectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const employee = await resolveEmployeeForUser(workspace.user.id);
  if (!employee) {
    return { ok: false, error: "No employee record linked to your account." };
  }

  const supabase = await createClient();
  const { data: record } = await supabase
    .from("attendance_records")
    .select("id, employee_id")
    .eq("id", parsed.data.attendance_record_id)
    .maybeSingle();

  if (!record || record.employee_id !== employee.id) {
    return { ok: false, error: "Attendance record not found." };
  }

  const { data: correction, error } = await supabase
    .from("attendance_correction_requests")
    .insert({
      employee_id: employee.id,
      attendance_record_id: parsed.data.attendance_record_id,
      reason: parsed.data.reason,
      requested_clock_in_at: parsed.data.requested_clock_in_at || null,
      requested_clock_out_at: parsed.data.requested_clock_out_at || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !correction) {
    return {
      ok: false,
      error: error?.message ?? "Unable to submit correction request.",
    };
  }

  const approval = await createApprovalRequest(supabase, {
    organizationId: employee.organization_id,
    workflowCode: "attendance_correction",
    entityType: "attendance_correction",
    entityId: correction.id,
    requesterUserId: workspace.user.id,
    payload: {
      attendance_record_id: parsed.data.attendance_record_id,
      requested_clock_in_at: parsed.data.requested_clock_in_at || null,
      requested_clock_out_at: parsed.data.requested_clock_out_at || null,
      reason: parsed.data.reason,
    },
  });

  if (!approval.ok) {
    return {
      ok: false,
      error: approval.error,
    };
  }

  revalidatePath("/app/my/attendance");
  revalidatePath("/app/my/requests");
  revalidatePath("/app/approvals");
  revalidatePath("/app/attendance/corrections");
  return { ok: true, message: "Correction request submitted." };
}

export async function reviewAttendanceCorrection(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) {
    return { ok: false, error: "Staff access required." };
  }
  if (
    !canAny(workspace.permissions, [
      "attendance.approve",
      "attendance.correct",
      "attendance.manage",
    ])
  ) {
    return {
      ok: false,
      error: "You do not have permission to review corrections.",
    };
  }

  const parsed = attendanceCorrectionReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid review request.",
    };
  }

  const supabase = await createClient();
  const { data: correction } = await supabase
    .from("attendance_correction_requests")
    .select(
      "id, status, attendance_record_id, requested_clock_in_at, requested_clock_out_at, employee_id",
    )
    .eq("id", parsed.data.correction_request_id)
    .maybeSingle();

  if (!correction || correction.status !== "pending") {
    return { ok: false, error: "Correction is not pending review." };
  }

  const advanced = await advanceApprovalRequest(supabase, workspace, {
    entityType: "attendance_correction",
    entityId: parsed.data.correction_request_id,
    action: parsed.data.action,
    notes: parsed.data.notes,
  });

  if (!advanced.ok) {
    return { ok: false, error: advanced.error };
  }

  const newStatus = parsed.data.action === "approve" ? "approved" : "rejected";

  if (parsed.data.action === "approve" && advanced.completed) {
    // A correction may change only one of the two clock times, so the effective
    // pair is the requested values merged over the record's current ones.
    // Resolving worked_minutes from the request alone would return null whenever
    // only one side was requested, leaving payroll to read a worked_minutes that
    // no longer matches the stored clock times.
    const { data: current } = await supabase
      .from("attendance_records")
      .select("clock_in_at, clock_out_at")
      .eq("id", correction.attendance_record_id)
      .maybeSingle();

    // The requested values arrive as naive `datetime-local` strings. Postgres
    // casts those as UTC, so storing one unchanged puts an Asia/Manila shift
    // 8 hours out. Convert them to real instants in the employee's timezone
    // first — the same rule the manual-entry path already uses.
    const { data: employeeRow } = await supabase
      .from("employees")
      .select("default_timezone")
      .eq("id", correction.employee_id)
      .maybeSingle();
    const timeZone = employeeRow?.default_timezone || DEFAULT_TIMEZONE;

    const requestedIn = naiveDateTimeToZoned(correction.requested_clock_in_at, timeZone);
    const requestedOut = naiveDateTimeToZoned(correction.requested_clock_out_at, timeZone);

    // A value the converter could not read is kept verbatim rather than dropped,
    // so a malformed request surfaces as the value the employee actually sent.
    const resolved = resolveCorrectedClockTimes(current, {
      clock_in_at: correction.requested_clock_in_at
        ? (requestedIn ?? correction.requested_clock_in_at)
        : null,
      clock_out_at: correction.requested_clock_out_at
        ? (requestedOut ?? correction.requested_clock_out_at)
        : null,
    });

    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }

    // RLS update on attendance_records needs attendance.correct/manage;
    // approve-only roles (e.g. team_lead) use service role after authz gate.
    const writer =
      canAny(workspace.permissions, [
        "attendance.correct",
        "attendance.manage",
      ])
        ? supabase
        : createAdminClient();

    const { error: recordError } = await writer
      .from("attendance_records")
      .update({ ...resolved.patch, approval_status: "finalized" })
      .eq("id", correction.attendance_record_id);

    if (recordError) {
      return {
        ok: false,
        error: recordError.message ?? "Unable to apply attendance times.",
      };
    }
  }

  if (!advanced.completed && parsed.data.action === "approve") {
    // Single-step workflow should always complete; multi-step keeps pending entity.
    return {
      ok: true,
      message: `Advanced past ${advanced.stepName}.`,
    };
  }

  const { error: correctionError } = await supabase
    .from("attendance_correction_requests")
    .update({
      status: newStatus,
      reviewed_by: workspace.user.id,
      review_notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.correction_request_id);

  if (correctionError) {
    return {
      ok: false,
      error: correctionError.message ?? "Unable to update correction.",
    };
  }

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: workspace.primaryMembership?.organization_id,
      action: `attendance_correction.${parsed.data.action}`,
      entityType: "attendance_correction",
      entityId: parsed.data.correction_request_id,
      before: { status: "pending" },
      after: { status: newStatus, step: advanced.stepName },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/attendance/corrections");
  revalidatePath("/app/attendance");
  revalidatePath("/app/approvals");
  revalidatePath("/app/my/attendance");
  return {
    ok: true,
    message:
      parsed.data.action === "approve"
        ? "Correction approved and attendance updated."
        : "Correction rejected.",
  };
}
