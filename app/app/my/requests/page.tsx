import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconFileText, IconTicket } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { CreateTicketForm } from "@/components/app/tickets/create-ticket-form";
import { CashAdvanceForm } from "@/components/app/cash-advance/cash-advance-form";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Requests" };

export default async function MyRequestsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const employee = await resolveEmployeeForUser(workspace.user.id);
  const supabase = await createClient();

  const ticketsQuery = supabase
    .from("tickets")
    .select("id, ticket_number, subject, status, created_at, category")
    .eq("requester_user_id", workspace.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const cashQuery = employee
    ? supabase
        .from("cash_advance_requests")
        .select("id, requested_amount, status, created_at, reason")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : Promise.resolve({ data: [] as never[] });

  const [{ data: tickets }, { data: cashAdvances }, { data: approvals }] =
    await Promise.all([
      ticketsQuery,
      cashQuery,
      supabase
        .from("approval_requests")
        .select("id, status, entity_type, created_at")
        .eq("requester_user_id", workspace.user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const hasItems =
    (tickets?.length ?? 0) > 0 ||
    (cashAdvances?.length ?? 0) > 0 ||
    (approvals?.length ?? 0) > 0;

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Track tickets, cash advances, and approval requests."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New support ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTicketForm />
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Cash advance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CashAdvanceForm />
          </CardContent>
        </Card>
      </div>

      {!hasItems ? (
        <EmptyState
          icon={IconFileText}
          title="No requests yet"
          description="Your submitted tickets and requests will appear here."
        />
      ) : (
        <div className="space-y-6">
          {(tickets?.length ?? 0) > 0 && (
            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-navy">
                Tickets
              </h2>
              {tickets!.map((ticket) => (
                <Card
                  key={ticket.id}
                  className=""
                >
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium text-navy">{ticket.subject}</p>
                      <p className="text-sm text-slate">
                        {ticket.ticket_number} ·{" "}
                        {format(new Date(ticket.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {ticket.status.replace(/_/g, " ")}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {(cashAdvances?.length ?? 0) > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-navy">
                  Cash advances
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/app/my/cash-advances" />}
                >
                  View all
                </Button>
              </div>
              {cashAdvances!.map((row) => (
                <Card
                  key={row.id}
                  className=""
                >
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium text-navy">
                        ₱{Number(row.requested_amount).toLocaleString()}
                      </p>
                      <p className="text-sm text-slate line-clamp-1">
                        {row.reason}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {row.status.replace(/_/g, " ")}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {(approvals?.length ?? 0) > 0 && (
            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-navy">
                Approvals
              </h2>
              {approvals!.map((req) => (
                <Card
                  key={req.id}
                  className=""
                >
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium capitalize text-navy">
                        {req.entity_type.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-slate">
                        {format(new Date(req.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {req.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </div>
      )}

      <Button
        variant="secondary"
        className="min-h-11"
        nativeButton={false}
        render={<Link href="/app/my/leave" />}
      >
        <IconTicket stroke={1.75} className="size-4" />
        Manage leave requests
      </Button>
    </PageContainer>
  );
}
