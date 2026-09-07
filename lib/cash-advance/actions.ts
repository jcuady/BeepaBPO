"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import {
  advanceApprovalRequest,
  createApprovalRequest,
} from "@/lib/approvals/engine";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { cashAdvanceSchema } from "@/lib/validation/app";

export async function createCashAdvanceRequest(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "cash_advance.self")) {
    return {
      ok: false,
      error: "You do not have permission to request cash advances.",
    };
  }

  const parsed = cashAdvanceSchema.safeParse(input);
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
  const { data: request, error } = await supabase
    .from("cash_advance_requests")
    .insert({
      employee_id: employee.id,
      requested_amount: parsed.data.requested_amount,
      remaining_balance: parsed.data.requested_amount,
      reason: parsed.data.reason,
      requested_repayment_periods:
        parsed.data.requested_repayment_periods ?? null,
      status: "hr_review",
    })
    .select("id")
    .single();

  if (error || !request) {
    return {
      ok: false,
      error: error?.message ?? "Unable to submit cash advance request.",
    };
  }

  const approval = await createApprovalRequest(supabase, {
    organizationId: employee.organization_id,
    workflowCode: "cash_advance",
    entityType: "cash_advance",
    entityId: request.id,
    requesterUserId: workspace.user.id,
    payload: {
      requested_amount: parsed.data.requested_amount,
      reason: parsed.data.reason,
    },
  });

  if (!approval.ok) {
    return { ok: false, error: approval.error };
  }

  revalidatePath("/app/my/cash-advances");
  revalidatePath("/app/my/requests");
  revalidatePath("/app/cash-advances");
  revalidatePath("/app/approvals");
  return { ok: true, message: "Cash advance request submitted." };
}

export async function reviewCashAdvance(
  requestId: string,
  action: "approve" | "reject",
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (
    !can(workspace.permissions, "cash_advance.approve") &&
    !can(workspace.permissions, "cash_advance.manage")
  ) {
    return { ok: false, error: "You do not have permission to review requests." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_advance_requests")
    .select("requested_amount, status")
    .eq("id", requestId)
    .in("status", ["pending", "hr_review", "finance_review"])
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Request not found or already processed." };
  }

  const advanced = await advanceApprovalRequest(supabase, workspace, {
    entityType: "cash_advance",
    entityId: requestId,
    action,
  });

  if (!advanced.ok) {
    return { ok: false, error: advanced.error };
  }

  let newStatus: "hr_review" | "finance_review" | "approved" | "rejected";
  if (action === "reject") {
    newStatus = "rejected";
  } else if (advanced.completed) {
    newStatus = "approved";
  } else {
    newStatus = "finance_review";
  }

  const { error } = await supabase
    .from("cash_advance_requests")
    .update({
      status: newStatus,
      approved_amount:
        newStatus === "approved" ? existing.requested_amount : null,
      approved_by: newStatus === "approved" ? workspace.user.id : null,
    })
    .eq("id", requestId);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update request." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: `cash_advance.${action}`,
    entityType: "cash_advance",
    entityId: requestId,
    before: { status: existing.status },
    after: {
      status: newStatus,
      step: advanced.stepName,
      completed: advanced.completed,
    },
  });

  revalidatePath("/app/cash-advances");
  revalidatePath("/app/approvals");
  return {
    ok: true,
    message:
      action === "reject"
        ? "Request rejected."
        : advanced.completed
          ? "Request approved."
          : `Advanced past ${advanced.stepName}.`,
  };
}
