import type { Metadata } from "next";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { TicketMessageForm } from "@/components/app/tickets/ticket-message-form";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Ticket" };

export default async function ClientTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ticket) notFound();

  const canView =
    ticket.requester_user_id === workspace.user.id ||
    (clientOrgId && ticket.client_organization_id === clientOrgId);

  if (!canView) notFound();

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

      <Card className="">
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
          <p className="text-sm text-slate whitespace-pre-wrap">
            {ticket.description}
          </p>
          <p className="text-xs text-slate">
            Opened {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
          </p>
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
              <Card
                key={msg.id}
                className=""
              >
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-slate">
                    {author?.display_name ?? "User"} ·{" "}
                    {format(new Date(msg.created_at), "MMM d, h:mm a")}
                  </p>
                  <p className="mt-2 text-sm text-navy whitespace-pre-wrap">
                    {msg.body}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card className="">
        <CardContent className="p-4">
          <TicketMessageForm ticketId={id} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
