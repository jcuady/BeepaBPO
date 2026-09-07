"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";

export type AttendanceActionResult = {
  ok: boolean;
  error?: string;
};

async function recordClockEvent(
  eventType: "clock_in" | "clock_out",
): Promise<AttendanceActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) {
    return { ok: false, error: "You must be signed in." };
  }

  if (!can(workspace.permissions, "attendance.self")) {
    return { ok: false, error: "You do not have permission to clock attendance." };
  }

  const employee = await resolveEmployeeForUser(workspace.user.id);
  if (!employee) {
    return {
      ok: false,
      error: "No employee record is linked to your account yet.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_event", {
    p_employee_id: employee.id,
    p_event_type: eventType,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Unable to record clock event.",
    };
  }

  revalidatePath("/app/my");
  revalidatePath("/app/my/attendance");
  return { ok: true };
}

export async function clockIn(): Promise<AttendanceActionResult> {
  return recordClockEvent("clock_in");
}

export async function clockOut(): Promise<AttendanceActionResult> {
  return recordClockEvent("clock_out");
}
