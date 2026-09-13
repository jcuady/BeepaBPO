"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import {
  advanceApprovalRequest,
  createApprovalRequest,
} from "@/lib/approvals/engine";
import { logAudit } from "@/lib/audit/log";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createClient } from "@/lib/supabase/server";
import {
  createPayrollPeriodSchema,
  payrollPeriodReviewSchema,
} from "@/lib/validation/app";

export async function createPayrollPeriod(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
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
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
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

const SUBMITTABLE = new Set(["draft", "preparing", "review"]);

/** Finance submits a draft/review period into the payroll approval workflow. */
export async function submitPayrollPeriodForApproval(
  payrollPeriodId: string,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  if (!can(workspace.permissions, "payroll.manage")) {
    return {
      ok: false,
      error: "You do not have permission to submit payroll for approval.",
    };
  }

  const supabase = await createClient();
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, name, status")
    .eq("id", payrollPeriodId)
    .eq("organization_id", BEEPA_ORG_ID)
    .maybeSingle();

  if (!period) {
    return { ok: false, error: "Payroll period not found." };
  }
  if (!SUBMITTABLE.has(period.status)) {
    return {
      ok: false,
      error: `Period is “${period.status}” and cannot be submitted.`,
    };
  }

  const { data: existingApproval } = await supabase
    .from("approval_requests")
    .select("id")
    .eq("entity_type", "payroll_period")
    .eq("entity_id", payrollPeriodId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingApproval) {
    return { ok: false, error: "This period already has a pending approval." };
  }

  const approval = await createApprovalRequest(supabase, {
    organizationId: BEEPA_ORG_ID,
    workflowCode: "payroll",
    entityType: "payroll_period",
    entityId: payrollPeriodId,
    requesterUserId: workspace.user.id,
    payload: { name: period.name, from_status: period.status },
  });

  if (!approval.ok) {
    return { ok: false, error: approval.error };
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "approval" })
    .eq("id", payrollPeriodId);

  if (error) {
    return {
      ok: false,
      error: error.message ?? "Unable to move period to approval.",
    };
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "payroll.period.submit_approval",
    entityType: "payroll_period",
    entityId: payrollPeriodId,
    before: { status: period.status },
    after: { status: "approval", requestId: approval.requestId },
  });

  revalidatePath("/app/payroll");
  revalidatePath("/app/payroll/periods");
  revalidatePath(`/app/payroll/periods/${payrollPeriodId}`);
  revalidatePath("/app/approvals");
  return { ok: true, message: "Payroll period submitted for approval." };
}

/** Advance or reject the current payroll workflow step (Finance → Owner). */
export async function reviewPayrollPeriod(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  if (
    !can(workspace.permissions, "payroll.manage") &&
    !can(workspace.permissions, "payroll.approve")
  ) {
    return {
      ok: false,
      error: "You do not have permission to review payroll periods.",
    };
  }

  const parsed = payrollPeriodReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid payroll review request." };
  }

  const supabase = await createClient();
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, name, status")
    .eq("id", parsed.data.payroll_period_id)
    .eq("organization_id", BEEPA_ORG_ID)
    .maybeSingle();

  if (!period || period.status !== "approval") {
    return {
      ok: false,
      error: "Payroll period is not awaiting approval.",
    };
  }

  const advanced = await advanceApprovalRequest(supabase, workspace, {
    entityType: "payroll_period",
    entityId: parsed.data.payroll_period_id,
    action: parsed.data.action,
  });

  if (!advanced.ok) {
    return { ok: false, error: advanced.error };
  }

  let nextStatus: "review" | "approval" | "finalized";
  if (parsed.data.action === "reject") {
    nextStatus = "review";
  } else if (advanced.completed) {
    nextStatus = "finalized";
  } else {
    nextStatus = "approval";
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: nextStatus })
    .eq("id", parsed.data.payroll_period_id);

  if (error) {
    return {
      ok: false,
      error: error.message ?? "Unable to update payroll period status.",
    };
  }

  if (nextStatus === "finalized") {
    const { error: recordsError } = await supabase
      .from("payroll_records")
      .update({ status: "finalized" })
      .eq("payroll_period_id", parsed.data.payroll_period_id)
      .neq("status", "void");

    if (recordsError) {
      return {
        ok: false,
        error:
          recordsError.message ??
          "Period finalized but records could not be updated.",
      };
    }
  }

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: `payroll.period.${parsed.data.action}`,
    entityType: "payroll_period",
    entityId: parsed.data.payroll_period_id,
    before: { status: period.status },
    after: {
      status: nextStatus,
      step: advanced.stepName,
      completed: advanced.completed,
    },
  });

  revalidatePath("/app/payroll");
  revalidatePath("/app/payroll/periods");
  revalidatePath(`/app/payroll/periods/${parsed.data.payroll_period_id}`);
  revalidatePath("/app/approvals");
  revalidatePath("/app/my/payroll");
  return {
    ok: true,
    message:
      parsed.data.action === "reject"
        ? "Payroll period sent back to review."
        : advanced.completed
          ? "Payroll period finalized."
          : `Advanced past ${advanced.stepName}.`,
  };
}
