import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconTicket } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { CreateTicketForm } from "@/components/app/tickets/create-ticket-form";
import { TicketSlaBadge } from "@/components/app/tickets/ticket-sla-badge";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Tickets" };

export default async function ClientTicketsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  let query = supabase
    .from("tickets")
    .select(
      "id, ticket_number, subject, status, created_at, priority, sla_due_at, resolved_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (clientOrgId) {
    query = query.eq("client_organization_id", clientOrgId);
  } else {
    query = query.eq("requester_user_id", workspace.user.id);
  }

  const { data: tickets } = await query;

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Track support and service tickets."
      />

      <Card className="">
        <CardContent className="p-4 sm:p-6">
          <CreateTicketForm />
        </CardContent>
      </Card>

      {!tickets?.length ? (
        <EmptyState
          icon={IconTicket}
          title="No tickets"
          description="Open a ticket when you need help from the Beepa team."
        />
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/app/client/tickets/${ticket.id}`}>
              <Card className="transition-colors hover:border-green/40">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-navy">{ticket.subject}</p>
                    <p className="text-sm text-slate">
                      {ticket.ticket_number} ·{" "}
                      {format(new Date(ticket.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TicketSlaBadge
                      slaDueAt={ticket.sla_due_at}
                      resolvedAt={ticket.resolved_at}
                      status={ticket.status}
                      createdAt={ticket.created_at}
                      showDue={false}
                    />
                    <Badge variant="outline" className="capitalize">
                      {ticket.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
