"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import {
  advanceApprovalRequest,
  createApprovalRequest,
} from "@/lib/approvals/engine";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can, canAny } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  attendanceCorrectionReviewSchema,
  attendanceCorrectionSchema,
} from "@/lib/validation/app";

function workedMinutesBetween(
  clockInAt: string | null,
  clockOutAt: string | null,
): number | null {
  if (!clockInAt || !clockOutAt) return null;
  const start = Date.parse(clockInAt);
  const end = Date.parse(clockOutAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.max(0, Math.round((end - start) / 60_000));
}

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
    const clockIn =
      correction.requested_clock_in_at ?? undefined;
    const clockOut =
      correction.requested_clock_out_at ?? undefined;
    const worked = workedMinutesBetween(
      correction.requested_clock_in_at,
      correction.requested_clock_out_at,
    );

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
      .update({
        ...(clockIn ? { clock_in_at: clockIn } : {}),
        ...(clockOut ? { clock_out_at: clockOut } : {}),
        ...(worked !== null ? { worked_minutes: worked } : {}),
        approval_status: "finalized",
      })
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
