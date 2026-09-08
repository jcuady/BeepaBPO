import type { Metadata } from "next";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { TicketMessageForm } from "@/components/app/tickets/ticket-message-form";
import { TicketSlaBadge } from "@/components/app/tickets/ticket-sla-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Ticket" };

export default async function MyTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ticket) notFound();
  if (ticket.requester_user_id !== workspace.user.id) notFound();

  const { data: messages } = await supabase
    .from("ticket_messages")
    .select("id, body, created_at, author_user_id, profiles(display_name)")
    .eq("ticket_id", id)
    .eq("is_internal", false)
    .order("created_at", { ascending: true });

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
            Opened {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
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
          </div>
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
                    {author?.display_name ?? "User"} ·{" "}
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
    </PageContainer>
  );
}
