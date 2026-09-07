"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { CASH_ADVANCE_WORKFLOW_ID } from "@/lib/constants/approvals";
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
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !request) {
    return {
      ok: false,
      error: error?.message ?? "Unable to submit cash advance request.",
    };
  }

  await supabase.from("approval_requests").insert({
    workflow_id: CASH_ADVANCE_WORKFLOW_ID,
    organization_id: employee.organization_id,
    entity_type: "cash_advance",
    entity_id: request.id,
    requester_user_id: workspace.user.id,
    status: "pending",
    payload: {
      requested_amount: parsed.data.requested_amount,
      reason: parsed.data.reason,
    },
  });

  revalidatePath("/app/my/cash-advances");
  revalidatePath("/app/my/requests");
  revalidatePath("/app/cash-advances");
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
    .select("requested_amount")
    .eq("id", requestId)
    .eq("status", "pending")
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Request not found or already processed." };
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  const { error } = await supabase
    .from("cash_advance_requests")
    .update({
      status: newStatus,
      approved_amount:
        action === "approve" ? existing.requested_amount : null,
      approved_by: action === "approve" ? workspace.user.id : null,
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
    entityType: "cash_advance_request",
    entityId: requestId,
    before: { status: "pending" },
    after: { status: newStatus },
  });

  revalidatePath("/app/cash-advances");
  return { ok: true, message: `Request ${newStatus}.` };
}
