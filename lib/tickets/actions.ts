"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import {
  ticketMessageSchema,
  ticketSchema,
  ticketStatusSchema,
} from "@/lib/validation/app";
import type { Database } from "@/types/database";

type TicketCategory = Database["public"]["Enums"]["ticket_category"];
type TicketPriority = Database["public"]["Enums"]["ticket_priority"];

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
