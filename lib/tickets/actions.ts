"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createClient } from "@/lib/supabase/server";
import {
  ticketAssignSchema,
  ticketMessageSchema,
  ticketSchema,
  ticketStatusSchema,
} from "@/lib/validation/app";
import type { Database } from "@/types/database";

type TicketCategory = Database["public"]["Enums"]["ticket_category"];
type TicketPriority = Database["public"]["Enums"]["ticket_priority"];
type TicketStatus = Database["public"]["Enums"]["ticket_status"];

export async function createTicket(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "tickets.self")) {
    return { ok: false, error: "You do not have permission to create tickets." };
  }

  const parsed = ticketSchema.safeParse(input);
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
  const { data: ticketNumber, error: numberError } = await supabase.rpc(
    "generate_ticket_number",
  );
  if (numberError || !ticketNumber) {
    return { ok: false, error: "Unable to generate ticket number." };
  }

  const employee = await resolveEmployeeForUser(workspace.user.id);
  const clientOrgId = getClientOrganizationId(workspace);

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      ticket_number: ticketNumber,
      requester_user_id: workspace.user.id,
      employee_id: employee?.id ?? null,
      client_organization_id: clientOrgId,
      category: parsed.data.category as TicketCategory,
      priority: (parsed.data.priority ?? "normal") as TicketPriority,
      subject: parsed.data.subject,
      description: parsed.data.description,
      status: "new",
    })
    .select("id")
    .single();

  if (error || !ticket) {
    return { ok: false, error: error?.message ?? "Unable to create ticket." };
  }

  const { notifyUser } = await import("@/lib/notifications/notify");
  if (workspace.user.id) {
    await notifyUser({
      userId: workspace.user.id,
      type: "ticket.created",
      title: "Ticket submitted",
      body: `We received your request: ${parsed.data.subject}`,
      actionUrl: `/app/tickets`,
      entityType: "ticket",
      entityId: ticket.id,
    });
  }

  revalidatePath("/app/my/requests");
  revalidatePath("/app/client/tickets");
  revalidatePath("/app/tickets");
  return {
    ok: true,
    message: "Ticket created.",
  };
}

export async function postTicketMessage(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (
    !can(workspace.permissions, "tickets.self") &&
    !can(workspace.permissions, "tickets.manage") &&
    !can(workspace.permissions, "tickets.read")
  ) {
    return { ok: false, error: "You do not have permission to post messages." };
  }

  const parsed = ticketMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Message is required.",
    };
  }

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, requester_user_id, first_response_at")
    .eq("id", parsed.data.ticket_id)
    .maybeSingle();

  if (!ticket) {
    return { ok: false, error: "Ticket not found." };
  }

  const isStaff = can(workspace.permissions, "tickets.manage");
  const isRequester = ticket.requester_user_id === workspace.user.id;
  if (!isStaff && !isRequester) {
    return { ok: false, error: "You cannot post on this ticket." };
  }

  const { error } = await supabase.from("ticket_messages").insert({
    ticket_id: parsed.data.ticket_id,
    author_user_id: workspace.user.id,
    body: parsed.data.body,
    is_internal: false,
  });

  if (error) {
    return { ok: false, error: error.message ?? "Unable to post message." };
  }

  // First public staff reply starts the first-response clock.
  if (isStaff && !ticket.first_response_at) {
    await supabase
      .from("tickets")
      .update({ first_response_at: new Date().toISOString() })
      .eq("id", parsed.data.ticket_id)
      .is("first_response_at", null);
  }

  revalidatePath(`/app/client/tickets/${parsed.data.ticket_id}`);
  revalidatePath(`/app/tickets/${parsed.data.ticket_id}`);
  revalidatePath("/app/tickets");
  return { ok: true, message: "Message posted." };
}

export async function updateTicketStatus(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "tickets.manage")) {
    return { ok: false, error: "You do not have permission to update tickets." };
  }

  const parsed = ticketStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid status update." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tickets")
    .select("status")
    .eq("id", parsed.data.ticket_id)
    .maybeSingle();

  const { error } = await supabase
    .from("tickets")
    .update({
      status: parsed.data.status,
      resolved_at:
        parsed.data.status === "resolved" || parsed.data.status === "closed"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", parsed.data.ticket_id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to update ticket." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: "ticket.status_update",
    entityType: "ticket",
    entityId: parsed.data.ticket_id,
    before: before ? { status: before.status } : null,
    after: { status: parsed.data.status },
  });

  revalidatePath("/app/tickets");
  revalidatePath(`/app/tickets/${parsed.data.ticket_id}`);
  revalidatePath(`/app/client/tickets/${parsed.data.ticket_id}`);
  return { ok: true, message: "Ticket status updated." };
}

export async function assignTicket(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  if (!can(workspace.permissions, "tickets.manage")) {
    return { ok: false, error: "You do not have permission to assign tickets." };
  }

  const parsed = ticketAssignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid assignment." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tickets")
    .select("id, status, assigned_user_id, subject, ticket_number")
    .eq("id", parsed.data.ticket_id)
    .maybeSingle();

  if (!before) {
    return { ok: false, error: "Ticket not found." };
  }

  const assigneeId = parsed.data.assigned_user_id;

  if (assigneeId) {
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("id")
      .eq("user_id", assigneeId)
      .eq("organization_id", BEEPA_ORG_ID)
      .eq("membership_type", "internal")
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return {
        ok: false,
        error: "Assignee must be an active Beepa teammate.",
      };
    }
  }

  const nextStatus: TicketStatus =
    assigneeId && before.status === "new"
      ? "assigned"
      : (before.status as TicketStatus);

  const { error } = await supabase
    .from("tickets")
    .update({
      assigned_user_id: assigneeId,
      status: nextStatus,
    })
    .eq("id", parsed.data.ticket_id);

  if (error) {
    return { ok: false, error: error.message ?? "Unable to assign ticket." };
  }

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit(supabase, {
    actorUserId: workspace.user.id,
    organizationId: workspace.primaryMembership?.organization_id,
    action: "ticket.assign",
    entityType: "ticket",
    entityId: parsed.data.ticket_id,
    before: {
      assigned_user_id: before.assigned_user_id,
      status: before.status,
    },
    after: {
      assigned_user_id: assigneeId,
      status: nextStatus,
    },
  });

  if (assigneeId && assigneeId !== workspace.user.id) {
    const { notifyUser } = await import("@/lib/notifications/notify");
    await notifyUser({
      userId: assigneeId,
      type: "ticket.assigned",
      title: "Ticket assigned to you",
      body: `${before.ticket_number}: ${before.subject}`,
      actionUrl: `/app/tickets/${parsed.data.ticket_id}`,
      entityType: "ticket",
      entityId: parsed.data.ticket_id,
    });
  }

  revalidatePath("/app/tickets");
  revalidatePath(`/app/tickets/${parsed.data.ticket_id}`);
  revalidatePath(`/app/client/tickets/${parsed.data.ticket_id}`);
  return {
    ok: true,
    message: assigneeId ? "Ticket assigned." : "Assignee cleared.",
  };
}
