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
import { listAllActiveEmployees } from "@/lib/pagination/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { writeFailed } from "@/lib/actions/error-copy";
import {
  createPayrollPeriodSchema,
  payrollPeriodReviewSchema,
  savePayrollSalarySchema,
} from "@/lib/validation/app";
import {
  fixedPayAmount,
  periodsOverlap,
  salaryFactorFor,
  windowForFrequency,
} from "@/lib/payroll/schedule";

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

  const cutoff = windowForFrequency(parsed.data.pay_frequency);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("payroll_periods")
    .select("id, start_date, end_date")
    .eq("organization_id", BEEPA_ORG_ID)
    .lte("start_date", cutoff.end_date)
    .gte("end_date", cutoff.start_date)
    .limit(5);

  const clash = (existing ?? []).find((period) =>
    periodsOverlap(cutoff, period),
  );
  if (clash) {
    return {
      ok: false,
      error:
        "A payroll run already covers this cutoff. Open that period instead of starting another.",
    };
  }

  const { data: period, error } = await supabase
    .from("payroll_periods")
    .insert({
      organization_id: BEEPA_ORG_ID,
      name: cutoff.name,
      start_date: cutoff.start_date,
      end_date: cutoff.end_date,
      pay_date: cutoff.pay_date,
      pay_frequency: cutoff.frequency,
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
    // Paged, not capped. This used to be a single `.limit(500)` with no `.order()`, which
    // meant an org with more than 500 active employees silently got payroll records for an
    // ARBITRARY 500 -- PostgREST promises no ordering, so the set could differ between two
    // runs on identical data -- while the action still returned ok:true with
    // `seeded: 500`. Whoever was dropped had no payroll record at all, and nothing in the
    // response said so. A BPO passing 500 headcount is routine, and this is the money path.
    let employees: { id: string }[];
    try {
      employees = await listAllActiveEmployees(supabase, BEEPA_ORG_ID);
    } catch (fetchError) {
      return {
        ok: false,
        error:
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load active employees for payroll seeding.",
      };
    }

    const salaryByEmployee = new Map<string, number>();
    if (employees?.length) {
      const { data: salaries } = await supabase
        .from("payroll_profiles")
        .select("employee_id, base_salary")
        .in(
          "employee_id",
          employees.map((employee) => employee.id),
        );
      for (const row of salaries ?? []) {
        salaryByEmployee.set(row.employee_id, Number(row.base_salary ?? 0));
      }
    }

    if (employees?.length) {
      const factor = salaryFactorFor(cutoff.frequency);
      const { error: seedError } = await supabase.from("payroll_records").insert(
        employees.map((e) => {
          const pay = fixedPayAmount(salaryByEmployee.get(e.id) ?? 0, factor);
          return {
            payroll_period_id: period.id,
            employee_id: e.id,
            status: "draft" as const,
            basic_pay: pay,
            gross_pay: pay,
            net_pay: pay,
          };
        }),
      );

      if (seedError) {
        await supabase.from("payroll_periods").delete().eq("id", period.id);
        return {
          ok: false,
          error: writeFailed("Unable to seed draft payroll records for this period."),
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
      start_date: cutoff.start_date,
      end_date: cutoff.end_date,
      pay_date: cutoff.pay_date,
      pay_frequency: cutoff.frequency,
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
    return { ok: false, error: writeFailed("Unable to recalculate.") };
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
      error: writeFailed("Unable to move period to approval."),
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
      error: writeFailed("Unable to update payroll period status."),
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
        error: writeFailed("Period finalized but records could not be updated."),
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

/** Fixed monthly salary and PH pay frequency. No tax or statutory fields. */
export async function saveEmployeePayrollSettings(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!workspace.isInternal) return { ok: false, error: "Staff access required." };
  if (!can(workspace.permissions, "payroll.manage")) {
    return { ok: false, error: "You do not have permission to edit payroll settings." };
  }

  const parsed = savePayrollSalarySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "Check the salary and frequency.",
    };
  }

  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("id", parsed.data.employee_id)
    .eq("organization_id", BEEPA_ORG_ID)
    .maybeSingle();

  if (!employee) return { ok: false, error: "Employee not found." };

  const { data: profile, error } = await supabase
    .from("payroll_profiles")
    .upsert(
      {
        employee_id: parsed.data.employee_id,
        pay_frequency: parsed.data.pay_frequency,
        compensation_type: "monthly_salary",
        base_salary: parsed.data.base_salary,
        currency: "PHP",
        active: true,
      },
      { onConflict: "employee_id" },
    )
    .select("id")
    .single();

  if (error || !profile) {
    return { ok: false, error: error?.message ?? "Unable to save salary." };
  }

  await supabase
    .from("employees")
    .update({ payroll_profile_id: profile.id })
    .eq("id", parsed.data.employee_id);

  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: BEEPA_ORG_ID,
    action: "payroll.settings.save",
    entityType: "payroll_profile",
    entityId: profile.id,
    after: {
      employee_id: parsed.data.employee_id,
      base_salary: parsed.data.base_salary,
      pay_frequency: parsed.data.pay_frequency,
    },
  });

  revalidatePath("/app/payroll/settings");
  revalidatePath("/app/payroll");
  return { ok: true, message: "Salary saved." };
}
