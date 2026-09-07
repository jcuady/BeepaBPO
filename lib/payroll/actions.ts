"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";

export async function recalculatePayrollRecord(
  payrollRecordId: string,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "payroll.manage")) {
    return { ok: false, error: "You do not have permission to recalculate payroll." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("calculate_payroll_record", {
    p_payroll_record_id: payrollRecordId,
  });

  if (error) {
    return { ok: false, error: error.message ?? "Unable to recalculate." };
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: "payroll.recalculate",
    entityType: "payroll_record",
    entityId: payrollRecordId,
  });

  revalidatePath("/app/payroll/periods");
  return { ok: true, message: "Payroll record recalculated." };
}
