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
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";
import { ListPager } from "@/components/app/list-pager";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { pageParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Tickets" };

const PAGE_SIZE = 50;

export default async function ClientTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  const page = pageParam((await searchParams).page);

  const clientOrgId = getClientOrganizationId(workspace);
  const canCreate = can(workspace.permissions, "tickets.self");
  const supabase = await createClient();

  let ticketingAllowed = true;
  if (clientOrgId) {
    const { data: settings } = await supabase
      .from("client_settings")
      .select("allow_ticketing")
      .eq("client_organization_id", clientOrgId)
      .maybeSingle();
    if (settings) ticketingAllowed = settings.allow_ticketing;
  }

  if (!ticketingAllowed) {
    return (
      <PageContainer>
        <PageHeader
          name={workspace.profile.first_name}
          subtitle="Track support and service tickets."
        />
        <EmptyState
          icon={IconTicket}
          title="Ticketing unavailable"
          description="Ticketing is turned off for your organization. Contact Beepa if you need to open requests."
        />
      </PageContainer>
    );
  }

  let query = supabase
    .from("tickets")
    .select(
      "id, ticket_number, subject, status, created_at, priority, sla_due_at, resolved_at",
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (clientOrgId) {
    query = query.eq("client_organization_id", clientOrgId);
  } else {
    query = query.eq("requester_user_id", workspace.user.id);
  }

  const { data: tickets } = await query;
  const showCreate = canCreate && ticketingAllowed;

  return (
    <PageContainer>
      <RealtimeRefresh
        tables={[
          clientOrgId
            ? {
                table: "tickets",
                filter: `client_organization_id=eq.${clientOrgId}`,
              }
            : {
                table: "tickets",
                filter: `requester_user_id=eq.${workspace.user.id}`,
              },
        ]}
      />
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Track support and service tickets."
      />

      {showCreate ? (
        <Card className="">
          <CardContent className="p-4 sm:p-6">
            <CreateTicketForm />
          </CardContent>
        </Card>
      ) : null}

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

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={tickets?.length ?? 0}
      />
    </PageContainer>
  );
}
