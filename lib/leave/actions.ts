"use server";

import { revalidatePath } from "next/cache";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { ActionResult } from "@/lib/actions/types";
import { LEAVE_WORKFLOW_ID } from "@/lib/constants/approvals";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import {
  leaveApprovalSchema,
  leaveRequestSchema,
} from "@/lib/validation/app";

function computeLeaveMinutes(startDate: string, endDate: string): number {
  const days =
    differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  return Math.max(1, days) * 480;
}

function toLeaveTimestamps(startDate: string, endDate: string) {
  return {
    start_at: `${startDate}T00:00:00.000Z`,
    end_at: `${endDate}T23:59:59.999Z`,
  };
}

export async function createLeaveRequest(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "leave.self")) {
    return { ok: false, error: "You do not have permission to request leave." };
  }

  const parsed = leaveRequestSchema.safeParse(input);
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
    return {
      ok: false,
      error: "No employee record is linked to your account yet.",
    };
  }

  const { start_at, end_at } = toLeaveTimestamps(
    parsed.data.start_date,
    parsed.data.end_date,
  );
  const requested_minutes = computeLeaveMinutes(
    parsed.data.start_date,
    parsed.data.end_date,
  );

  const supabase = await createClient();
  const { data: leaveRequest, error: leaveError } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: employee.id,
      leave_type_id: parsed.data.leave_type_id,
      start_at,
      end_at,
      reason: parsed.data.reason ?? "",
      requested_minutes,
      status: "pending",
    })
    .select("id")
    .single();

  if (leaveError || !leaveRequest) {
    return {
      ok: false,
      error: leaveError?.message ?? "Unable to submit leave request.",
    };
  }

  const { error: approvalError } = await supabase
    .from("approval_requests")
    .insert({
      workflow_id: LEAVE_WORKFLOW_ID,
      organization_id: employee.organization_id,
      entity_type: "leave_request",
      entity_id: leaveRequest.id,
      requester_user_id: workspace.user.id,
      status: "pending",
      payload: {
        leave_type_id: parsed.data.leave_type_id,
        start_at,
        end_at,
        requested_minutes,
      },
    });

  if (approvalError) {
    return {
      ok: false,
      error: approvalError.message ?? "Leave saved but approval queue failed.",
    };
  }

  try {
    const { notifyUser } = await import("@/lib/notifications/notify");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("membership_roles")
      .select(
        "membership_id, roles!inner(code), organization_memberships!inner(user_id, organization_id, status)",
      )
      .eq("roles.code", "hr")
      .eq("organization_memberships.organization_id", employee.organization_id)
      .eq("organization_memberships.status", "active");
    for (const row of rows ?? []) {
      const membership = row.organization_memberships as unknown as {
        user_id: string;
      };
      if (!membership?.user_id || membership.user_id === workspace.user.id) continue;
      await notifyUser({
        userId: membership.user_id,
        type: "leave.request",
        title: "Leave request pending",
        body: "A team member submitted a leave request for review.",
        actionUrl: "/app/leave",
        entityType: "leave_request",
        entityId: leaveRequest.id,
      });
    }
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/my/leave");
  revalidatePath("/app/my/requests");
  revalidatePath("/app/leave");
  return { ok: true, message: "Leave request submitted." };
}

export async function cancelLeaveRequest(
  leaveRequestId: string,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "leave.self")) {
    return { ok: false, error: "You do not have permission to cancel leave." };
  }

  const employee = await resolveEmployeeForUser(workspace.user.id);
  if (!employee) return { ok: false, error: "Employee record not found." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("leave_requests")
    .select("id, status, employee_id")
    .eq("id", leaveRequestId)
    .maybeSingle();

  if (!existing || existing.employee_id !== employee.id) {
    return { ok: false, error: "Leave request not found." };
  }
  if (existing.status !== "pending") {
    return { ok: false, error: "Only pending requests can be cancelled." };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", leaveRequestId);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to cancel request." };
  }

  await supabase
    .from("approval_requests")
    .update({ status: "cancelled" })
    .eq("entity_type", "leave_request")
    .eq("entity_id", leaveRequestId);

  revalidatePath("/app/my/leave");
  revalidatePath("/app/leave");
  return { ok: true, message: "Leave request cancelled." };
}

export async function reviewLeaveRequest(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "leave.approve")) {
    return { ok: false, error: "You do not have permission to approve leave." };
  }

  const parsed = leaveApprovalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Invalid approval request.",
    };
  }

  const supabase = await createClient();
  const { data: leaveRequest } = await supabase
    .from("leave_requests")
    .select("id, status")
    .eq("id", parsed.data.leave_request_id)
    .maybeSingle();

  if (!leaveRequest || leaveRequest.status !== "pending") {
    return { ok: false, error: "Leave request is not pending approval." };
  }

  const { data: approvalRequest } = await supabase
    .from("approval_requests")
    .select("id, current_step, status")
    .eq("entity_type", "leave_request")
    .eq("entity_id", parsed.data.leave_request_id)
    .eq("status", "pending")
    .maybeSingle();

  if (!approvalRequest) {
    return { ok: false, error: "Approval workflow not found." };
  }

  const { error: actionError } = await supabase.from("approval_actions").insert({
    request_id: approvalRequest.id,
    step_order: approvalRequest.current_step,
    actor_user_id: workspace.user.id,
    action: parsed.data.action,
    notes: parsed.data.notes ?? null,
  });

  if (actionError) {
    return { ok: false, error: actionError.message ?? "Unable to record action." };
  }

  const newLeaveStatus =
    parsed.data.action === "approve" ? "approved" : "rejected";
  const newApprovalStatus =
    parsed.data.action === "approve" ? "approved" : "rejected";

  const { error: leaveError } = await supabase
    .from("leave_requests")
    .update({ status: newLeaveStatus })
    .eq("id", parsed.data.leave_request_id);

  if (leaveError) {
    return { ok: false, error: leaveError.message ?? "Unable to update leave." };
  }

  await supabase
    .from("approval_requests")
    .update({ status: newApprovalStatus })
    .eq("id", approvalRequest.id);

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: `leave.${parsed.data.action}`,
    entityType: "leave_request",
    entityId: parsed.data.leave_request_id,
    before: { status: "pending" },
    after: { status: newLeaveStatus },
  });

  try {
    const { data: leaveRow } = await supabase
      .from("leave_requests")
      .select("employee_id, employees(profile_id)")
      .eq("id", parsed.data.leave_request_id)
      .maybeSingle();
    const profileId = (
      leaveRow?.employees as unknown as { profile_id: string } | null
    )?.profile_id;
    if (profileId) {
      const { notifyUser } = await import("@/lib/notifications/notify");
      await notifyUser({
        userId: profileId,
        type: "leave.decision",
        title:
          parsed.data.action === "approve"
            ? "Leave approved"
            : "Leave rejected",
        body:
          parsed.data.action === "approve"
            ? "Your leave request was approved."
            : "Your leave request was rejected.",
        actionUrl: "/app/my/leave",
        entityType: "leave_request",
        entityId: parsed.data.leave_request_id,
      });
    }
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/leave");
  revalidatePath("/app/my/leave");
  return {
    ok: true,
    message:
      parsed.data.action === "approve"
        ? "Leave request approved."
        : "Leave request rejected.",
  };
}
