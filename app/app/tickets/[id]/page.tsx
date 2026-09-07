import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { TicketMessageForm } from "@/components/app/tickets/ticket-message-form";
import { TicketStatusForm } from "@/components/app/tickets/ticket-status-form";
import { TicketSlaBadge } from "@/components/app/tickets/ticket-sla-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ticket" };

export default async function StaffTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "tickets.read");

  const supabase = await createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase.from("tickets").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("ticket_messages")
      .select("id, body, created_at, author_user_id, is_internal, profiles(display_name)")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!ticket) notFound();

  const canManage = can(workspace.permissions, "tickets.manage");

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={ticket.ticket_number}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="font-display text-base text-navy">
              {ticket.subject}
            </CardTitle>
            <Badge variant="outline" className="capitalize">
              {ticket.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm text-slate">
            {ticket.description}
          </p>
          <p className="text-xs text-slate">
            Opened {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")} ·{" "}
            {ticket.category} · {ticket.priority}
          </p>
          <div className="text-sm text-navy">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">
              SLA
            </p>
            <TicketSlaBadge
              slaDueAt={ticket.sla_due_at}
              resolvedAt={ticket.resolved_at}
              status={ticket.status}
              createdAt={ticket.created_at}
            />
            {ticket.first_response_at ? (
              <p className="mt-1 text-xs text-slate">
                First response{" "}
                {format(new Date(ticket.first_response_at), "MMM d, h:mm a")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate">Awaiting first response</p>
            )}
          </div>
          {canManage ? (
            <TicketStatusForm
              ticketId={id}
              currentStatus={ticket.status}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-navy">
          Messages
        </h2>
        {(messages ?? []).length === 0 ? (
          <p className="text-sm text-slate">No messages yet.</p>
        ) : (
          (messages ?? []).map((msg) => {
            const author = msg.profiles as { display_name: string } | null;
            return (
              <Card key={msg.id}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-slate">
                    {author?.display_name ?? "User"}
                    {msg.is_internal ? " (internal)" : ""} ·{" "}
                    {format(new Date(msg.created_at), "MMM d, h:mm a")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-navy">
                    {msg.body}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <TicketMessageForm ticketId={id} />
        </CardContent>
      </Card>

      <Link
        href="/app/tickets"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to tickets
      </Link>
    </PageContainer>
  );
}
