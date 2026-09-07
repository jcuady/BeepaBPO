import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconFileText } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Requests" };

export default async function ClientRequestsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  let tickets: {
    id: string;
    ticket_number: string;
    subject: string;
    status: string;
    category: string;
    created_at: string;
  }[] = [];

  if (clientOrgId) {
    const { data } = await supabase
      .from("tickets")
      .select("id, ticket_number, subject, status, category, created_at")
      .eq("client_organization_id", clientOrgId)
      .order("created_at", { ascending: false })
      .limit(50);
    tickets = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Staffing and operational requests tracked as tickets."
      />
      {tickets.length === 0 ? (
        <EmptyState
          icon={IconFileText}
          title="No open requests"
          description="Open a ticket when you need staffing or operational help."
          actionLabel="Create ticket"
          actionHref="/app/client/tickets"
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
    </PageContainer>
  );
}
