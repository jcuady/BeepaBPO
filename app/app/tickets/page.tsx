import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconTicket } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { TicketStatusForm } from "@/components/app/tickets/ticket-status-form";
import { PageContainer } from "@/components/app/page-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { stringParam, enumParam, ilikePattern } from "@/lib/app/search-params";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Tickets" };

const STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "waiting_for_client",
  "resolved",
  "closed",
] as const;

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export default async function InternalTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "tickets.read");

  const params = await searchParams;
  const q = stringParam(params.q);
  const status = enumParam(params.status, STATUSES);
  const priority = enumParam(params.priority, PRIORITIES);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("tickets")
    .select(
      "id, ticket_number, subject, status, priority, category, created_at, client_organization_id, organizations(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (pattern) {
    query = query.or(`subject.ilike.${pattern},ticket_number.ilike.${pattern}`);
  }
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);

  const { data: tickets } = await query;
  const canManage = can(workspace.permissions, "tickets.manage");

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Manage support queues and update ticket status."
      />

      <form method="get">
        <FilterBar placeholder="Search subject or number…" defaultValue={q}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({
                value: s,
                label: s.replace(/_/g, " "),
              })),
            ]}
          />
          <FilterSelect
            name="priority"
            label="Priority"
            defaultValue={priority}
            options={[
              { value: "", label: "All priorities" },
              ...PRIORITIES.map((p) => ({ value: p, label: p })),
            ]}
          />
        </FilterBar>
      </form>

      {!tickets?.length ? (
        <EmptyState
          icon={IconTicket}
          title="No tickets"
          description="Support tickets from employees and clients will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {canManage ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => {
                const org = ticket.organizations as { name: string } | null;
                return (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <Link
                        href={`/app/tickets/${ticket.id}`}
                        className="font-medium text-navy hover:text-green-strong"
                      >
                        {ticket.subject}
                      </Link>
                      <p className="text-xs text-slate">
                        {ticket.ticket_number}
                        {org ? ` · ${org.name}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell className="text-slate">
                      {format(new Date(ticket.created_at), "MMM d, yyyy")}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <TicketStatusForm
                          ticketId={ticket.id}
                          currentStatus={ticket.status}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
