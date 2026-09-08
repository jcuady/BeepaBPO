"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createClient } from "@/lib/supabase/server";
import { employeeUpdateSchema } from "@/lib/validation/app";
import type { Database } from "@/types/database";

type EmploymentStatus = Database["public"]["Enums"]["employment_status"];
type EmploymentType = Database["public"]["Enums"]["employment_type"];

export async function updateEmployee(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "employees.manage")) {
    return { ok: false, error: "You do not have permission to edit employees." };
  }

  const parsed = employeeUpdateSchema.safeParse(input);
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
  const { data: before } = await supabase
    .from("employees")
    .select(
      "id, job_title, employment_status, employment_type, hire_date, work_email, personal_email, default_timezone",
    )
    .eq("id", parsed.data.employee_id)
    .maybeSingle();

  if (!before) {
    return { ok: false, error: "Employee not found." };
  }

  const after = {
    job_title: parsed.data.job_title?.trim() || "",
    employment_status: parsed.data.employment_status as EmploymentStatus,
    employment_type: parsed.data.employment_type as EmploymentType,
    hire_date: parsed.data.hire_date || null,
    work_email: parsed.data.work_email?.trim() || null,
    personal_email: parsed.data.personal_email?.trim() || null,
    default_timezone: parsed.data.default_timezone,
  };

  const { error } = await supabase
    .from("employees")
    .update(after)
    .eq("id", parsed.data.employee_id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update employee." };
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId:
      workspace.primaryMembership?.organization_id ?? BEEPA_ORG_ID,
    action: "employees.update",
    entityType: "employee",
    entityId: parsed.data.employee_id,
    before,
    after,
  });

  revalidatePath(`/app/employees/${parsed.data.employee_id}`);
  revalidatePath("/app/employees");
  revalidatePath("/app/hr");
  return { ok: true, message: "Employee record updated." };
}
