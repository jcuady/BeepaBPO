"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { logAudit } from "@/lib/audit/log";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createClient } from "@/lib/supabase/server";
import { createPayrollPeriodSchema } from "@/lib/validation/app";

export async function createPayrollPeriod(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "payroll.manage")) {
    return {
      ok: false,
      error: "You do not have permission to create payroll periods.",
    };
  }

  const parsed = createPayrollPeriodSchema.safeParse(input);
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
  const { data: period, error } = await supabase
    .from("payroll_periods")
    .insert({
      organization_id: BEEPA_ORG_ID,
      name: parsed.data.name.trim(),
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      pay_date: parsed.data.pay_date,
      status: "draft",
      created_by: workspace.user.id,
    })
    .select("id, name")
    .single();

  if (error || !period) {
    return {
      ok: false,
      error: error?.message ?? "Unable to create payroll period.",
    };
  }

  let seeded = 0;
  if (parsed.data.seed_records) {
    const { data: employees } = await supabase
      .from("employees")
      .select("id")
      .eq("organization_id", BEEPA_ORG_ID)
      .eq("employment_status", "active")
      .limit(500);

    if (employees?.length) {
      const { error: seedError } = await supabase.from("payroll_records").insert(
        employees.map((e) => ({
          payroll_period_id: period.id,
          employee_id: e.id,
          status: "draft" as const,
        })),
      );

      if (seedError) {
        await supabase.from("payroll_periods").delete().eq("id", period.id);
        return {
          ok: false,
          error:
            seedError.message ??
            "Unable to seed draft payroll records for this period.",
        };
      }
      seeded = employees.length;
    }
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "payroll.period.create",
    entityType: "payroll_period",
    entityId: period.id,
    after: {
      name: period.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      pay_date: parsed.data.pay_date,
      seeded_records: seeded,
    },
  });

  revalidatePath("/app/payroll");
  revalidatePath("/app/payroll/periods");
  revalidatePath(`/app/payroll/periods/${period.id}`);
  return {
    ok: true,
    message:
      seeded > 0
        ? `Period “${period.name}” created with ${seeded} draft record${seeded === 1 ? "" : "s"}.`
        : `Period “${period.name}” created.`,
  };
}

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
