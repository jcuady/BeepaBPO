"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createClient } from "@/lib/supabase/server";
import {
  attendanceRecordDeleteSchema,
  attendanceRecordUpsertSchema,
} from "@/lib/validation/app";
import type { Database } from "@/types/database";

type AttendanceStatus = Database["public"]["Enums"]["attendance_record_status"];

function combineLocal(workDate: string, time: string | undefined): string | null {
  if (!time) return null;
  const hm = time.slice(0, 5);
  const dt = new Date(`${workDate}T${hm}:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function workedFromClocks(
  clockIn: string | null,
  clockOut: string | null,
): number {
  if (!clockIn || !clockOut) return 0;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

function orgId(
  workspace: NonNullable<Awaited<ReturnType<typeof resolveWorkspace>>>,
) {
  return workspace.primaryMembership?.organization_id ?? BEEPA_ORG_ID;
}

export async function upsertAttendanceRecord(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) {
    return { ok: false, error: "Internal staff only." };
  }
  if (!can(workspace.permissions, "attendance.manage")) {
    return { ok: false, error: "You do not have permission to edit attendance." };
  }

  const parsed = attendanceRecordUpsertSchema.safeParse(input);
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

  const supabase = await createClient();
  const existingId = parsed.data.id || undefined;
  let employeeId = parsed.data.employee_id;
  let workDate = parsed.data.work_date;
  if (existingId) {
    const { data: before } = await supabase
      .from("attendance_records")
      .select(
        "id, employee_id, work_date, status, clock_in_at, clock_out_at, approval_status, worked_minutes",
      )
      .eq("id", existingId)
      .maybeSingle();
    if (!before) return { ok: false, error: "Attendance record not found." };
    if (before.approval_status === "finalized") {
      return { ok: false, error: "Finalized timesheets cannot be edited." };
    }
    employeeId = before.employee_id;
    workDate = before.work_date;
  }

  const clockIn = combineLocal(workDate, parsed.data.clock_in);
  const clockOut = combineLocal(workDate, parsed.data.clock_out);
  if (clockIn && clockOut && new Date(clockOut) <= new Date(clockIn)) {
    return {
      ok: false,
      fieldErrors: { clock_out: ["Clock out must be after clock in."] },
      error: "Clock out must be after clock in.",
    };
  }

  const payload = {
    employee_id: employeeId,
    work_date: workDate,
    status: parsed.data.status as AttendanceStatus,
    clock_in_at: clockIn,
    clock_out_at: clockOut,
    worked_minutes: workedFromClocks(clockIn, clockOut),
  };

  const { data, error } = existingId
    ? await supabase
        .from("attendance_records")
        .update(payload)
        .eq("id", existingId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("attendance_records")
        .upsert(payload, { onConflict: "employee_id,work_date" })
        .select("id")
        .maybeSingle();

  if (error) {
    return { ok: false, error: error.message ?? "Unable to save attendance." };
  }
  if (!data?.id) {
    return { ok: false, error: "Unable to save attendance." };
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: orgId(workspace),
    action: existingId ? "attendance.update" : "attendance.create",
    entityType: "attendance_record",
    entityId: data?.id ?? existingId ?? null,
    after: payload,
  });

  revalidatePath("/app/attendance");
  revalidatePath("/app/hr");
  return { ok: true, message: "Attendance saved." };
}

export async function deleteAttendanceRecord(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) {
    return { ok: false, error: "Internal staff only." };
  }
  if (!can(workspace.permissions, "attendance.manage")) {
    return { ok: false, error: "You do not have permission to delete attendance." };
  }

  const parsed = attendanceRecordDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Record is required." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("attendance_records")
    .select("id, employee_id, work_date, status, approval_status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) return { ok: false, error: "Attendance record not found." };
  if (before.approval_status === "finalized") {
    return { ok: false, error: "Finalized timesheets cannot be deleted." };
  }

  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to delete attendance." };
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: orgId(workspace),
    action: "attendance.delete",
    entityType: "attendance_record",
    entityId: parsed.data.id,
    before,
  });

  revalidatePath("/app/attendance");
  revalidatePath("/app/hr");
  return { ok: true, message: "Attendance record deleted." };
}
