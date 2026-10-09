"use server";

import { revalidatePath } from "next/cache";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { ActionResult } from "@/lib/actions/types";
import {
  advanceApprovalRequest,
  createApprovalRequest,
} from "@/lib/approvals/engine";
import { buildLeaveDecisionNotificationBody, buildLeaveRequestNotificationBody } from "@/lib/leave/notification-body";
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

  const approval = await createApprovalRequest(supabase, {
    organizationId: employee.organization_id,
    workflowCode: "leave",
    entityType: "leave_request",
    entityId: leaveRequest.id,
    requesterUserId: workspace.user.id,
    payload: {
      leave_type_id: parsed.data.leave_type_id,
      start_at,
      end_at,
      requested_minutes,
    },
  });

  if (!approval.ok) {
    return { ok: false, error: approval.error };
  }

  try {
    const { notifyUser } = await import("@/lib/notifications/notify");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    // Name the leave type. A notification that says only "a team member
    // submitted a leave request" is unactionable: the live table held 27 of them,
    // byte-identical, so a team lead could not tell any two apart.
    const { data: leaveType } = await admin
      .from("leave_types")
      .select("name")
      .eq("id", parsed.data.leave_type_id)
      .maybeSingle();
    const typeName = leaveType?.name?.trim();

    const { data: rows } = await admin
      .from("membership_roles")
      .select(
        "membership_id, roles!inner(code), organization_memberships!inner(user_id, organization_id, status)",
      )
      .eq("roles.code", "team_lead")
      .eq("organization_memberships.organization_id", employee.organization_id)
      .eq("organization_memberships.status", "active");

    const body = buildLeaveRequestNotificationBody({
      requesterName: workspace.profile?.display_name,
      leaveTypeName: typeName,
      startDate: parsed.data.start_date,
      endDate: parsed.data.end_date,
    });

    for (const row of rows ?? []) {
      const membership = row.organization_memberships as unknown as {
        user_id: string;
      };
      if (!membership?.user_id || membership.user_id === workspace.user.id) {
        continue;
      }
      await notifyUser({
        userId: membership.user_id,
        type: "leave.request",
        title: "Leave request pending",
        body,
        actionUrl: "/app/leave",
        entityType: "leave_request",
        entityId: leaveRequest.id,
      });
    }
  } catch (notifyError) {
    // Still non-blocking for the request itself, but no longer silent: a
    // swallowed throw here means a manager never learns a request is waiting,
    // and nothing in the logs says why.
    console.error("[leave] notification failed", notifyError);
  }

  revalidatePath("/app/my/leave");
  revalidatePath("/app/my/requests");
  revalidatePath("/app/leave");
  revalidatePath("/app/approvals");
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
  if (existing.status !== "pending" && existing.status !== "manager_approved") {
    return { ok: false, error: "Only open requests can be cancelled." };
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
    .eq("entity_id", leaveRequestId)
    .eq("status", "pending");

  revalidatePath("/app/my/leave");
  revalidatePath("/app/leave");
  revalidatePath("/app/approvals");
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

  if (
    !leaveRequest ||
    (leaveRequest.status !== "pending" &&
      leaveRequest.status !== "manager_approved")
  ) {
    return { ok: false, error: "Leave request is not awaiting approval." };
  }

  const advanced = await advanceApprovalRequest(supabase, workspace, {
    entityType: "leave_request",
    entityId: parsed.data.leave_request_id,
    action: parsed.data.action,
    notes: parsed.data.notes,
  });

  if (!advanced.ok) {
    return { ok: false, error: advanced.error };
  }

  let newLeaveStatus: "manager_approved" | "approved" | "rejected";
  if (parsed.data.action === "reject") {
    newLeaveStatus = "rejected";
  } else if (advanced.completed) {
    newLeaveStatus = "approved";
  } else {
    newLeaveStatus = "manager_approved";
  }

  const { error: leaveError } = await supabase
    .from("leave_requests")
    .update({ status: newLeaveStatus })
    .eq("id", parsed.data.leave_request_id);

  if (leaveError) {
    return { ok: false, error: leaveError.message ?? "Unable to update leave." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: `leave.${parsed.data.action}`,
    entityType: "leave_request",
    entityId: parsed.data.leave_request_id,
    before: { status: leaveRequest.status },
    after: {
      status: newLeaveStatus,
      step: advanced.stepName,
      completed: advanced.completed,
    },
  });

  if (advanced.completed) {
    try {
      // `employees` has no `display_name` column — adding it to this embed made
      // PostgREST reject the whole select, `leaveRow` came back null, and the
      // decision notification silently never fired. Caught only by exercising
      // the workflow end to end.
      const { data: leaveRow } = await supabase
        .from("leave_requests")
        .select("start_at, end_at, employees(profile_id)")
        .eq("id", parsed.data.leave_request_id)
        .maybeSingle();
      const profileId = (
        leaveRow?.employees as unknown as { profile_id: string } | null
      )?.profile_id;
      if (profileId) {
        const { notifyUser } = await import("@/lib/notifications/notify");
        const approved = parsed.data.action === "approve";
        const body = leaveRow?.start_at
          ? buildLeaveDecisionNotificationBody({
              startDate: leaveRow.start_at.slice(0, 10),
              endDate: (leaveRow.end_at ?? leaveRow.start_at).slice(0, 10),
              approved,
              decidedBy: workspace.profile?.display_name,
            })
          : `Your leave request was ${approved ? "approved" : "rejected"}.`;
        await notifyUser({
          userId: profileId,
          type: "leave.decision",
          title: approved ? "Leave approved" : "Leave rejected",
          body,
          actionUrl: "/app/my/leave",
          entityType: "leave_request",
          entityId: parsed.data.leave_request_id,
        });
      } else {
        console.error(
          `[leave] decision notification skipped: no employee profile for leave ${parsed.data.leave_request_id}`,
        );
      }
    } catch (notifyError) {
      console.error("[leave] decision notification failed", notifyError);
    }
  }

  revalidatePath("/app/leave");
  revalidatePath("/app/my/leave");
  revalidatePath("/app/approvals");
  return {
    ok: true,
    message:
      parsed.data.action === "reject"
        ? "Leave request rejected."
        : advanced.completed
          ? "Leave request approved."
          : `Leave advanced past ${advanced.stepName}.`,
  };
}
