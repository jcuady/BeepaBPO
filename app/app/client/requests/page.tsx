import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconFileText } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { enumParam, pageParam, stringParam, ilikePattern } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Requests" };

const PAGE_SIZE = 30;
const STATUSES = ["new", "assigned", "in_progress", "waiting_for_client", "resolved", "closed"] as const;

export default async function ClientRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const params = await searchParams;
  const q = stringParam(params.q);
  const status = enumParam(params.status, STATUSES);
  const page = pageParam(params.page);

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
          title="Requests"
          name={workspace.profile.first_name}
          subtitle="Staffing and operational requests tracked as tickets."
        />
        <EmptyState
          icon={IconFileText}
          title="Requests unavailable"
          description="Ticketing is turned off for your organization. Contact Beepa if you need to open requests."
        />
      </PageContainer>
    );
  }

  let tickets: {
    id: string;
    ticket_number: string;
    subject: string;
    status: string;
    category: string;
    created_at: string;
  }[] = [];

  if (clientOrgId) {
    let query = supabase
      .from("tickets")
      .select("id, ticket_number, subject, status, category, created_at")
      .eq("client_organization_id", clientOrgId)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (status) query = query.eq("status", status);
    if (q) query = query.ilike("subject", ilikePattern(q) ?? "");
    const { data } = await query;
    // One extra row proves a next page exists; drop it so rowCount is the rendered count.
    tickets = data?.slice(0, PAGE_SIZE) ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        title="Requests"
        name={workspace.profile.first_name}
        subtitle="Staffing and operational requests tracked as tickets."
      />

      <form method="get">
        <FilterBar placeholder="Search subject…" defaultValue={q}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
            ]}
          />
        </FilterBar>
      </form>

      {tickets.length === 0 ? (
        <EmptyState
          icon={IconFileText}
          title="No open requests"
          description="Open a ticket when you need staffing or operational help."
          actionLabel={canCreate ? "Create ticket" : undefined}
          actionHref={canCreate ? "/app/client/tickets" : undefined}
        />
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/app/client/tickets/${ticket.id}`}>
              <Card className="transition-colors hover:border-green/40">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-base text-navy sm:text-sm">{ticket.subject}</p>
                    <p className="text-base text-slate sm:text-sm">
                      {ticket.ticket_number} · {ticket.category.replace(/_/g, " ")} ·{" "}
                      {format(new Date(ticket.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {ticket.status.replace(/_/g, " ")}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={tickets.length}
        query={{ q, status }}
      />
    </PageContainer>
  );
}