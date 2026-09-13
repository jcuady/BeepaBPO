import Link from "next/link";
import {
  IconChartBar,
  IconClock,
  IconReportAnalytics,
  IconTicket,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import { format, subDays } from "date-fns";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import {
  WeeklyAttendanceChartLazy as WeeklyAttendanceChart,
  TeamStatusDonutLazy as TeamStatusDonut,
} from "@/components/app/charts-lazy";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/app/page-container";
import { slaCompliancePercent } from "@/lib/tickets/sla";

export default async function ClientDashboardPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login?next=/app/client");
  if (!workspace.isClient) redirect("/app/my");

  const supabase = await createClient();
  const orgName = workspace.primaryMembership?.organization.name ?? "your team";
  const name = workspace.profile.first_name || workspace.profile.display_name;

  const clientOrgId = workspace.primaryMembership?.organization_id;

  const today = format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(new Date(), 13), "yyyy-MM-dd");

  const [teamResult, pendingResult, ticketResult, attendanceResult, todayResult, invoiceResult, managerResult, slaResult] =
    clientOrgId
      ? await Promise.all([
          supabase
            .from("client_visible_employees")
            .select(
              "employee_id, display_name, job_title, role_title, assignment_status",
            )
            .eq("client_organization_id", clientOrgId)
            .order("display_name")
            .limit(200),
          supabase
            .from("client_attendance_summary")
            .select("*", { count: "exact", head: true })
            .eq("client_organization_id", clientOrgId)
            .eq("approval_status", "client_review"),
          supabase
            .from("tickets")
            .select("id, subject, status, ticket_number", { count: "exact" })
            .eq("client_organization_id", clientOrgId)
            .not("status", "in", "(resolved,closed)")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("client_attendance_summary")
            .select("work_date, worked_minutes, status, employee_id")
            .eq("client_organization_id", clientOrgId)
            .gte("work_date", from)
            // ponytail: chart sample cap; upgrade to SQL GROUP BY if teams grow large
            .limit(2000),
          supabase
            .from("client_attendance_summary")
            .select("status, employee_id")
            .eq("client_organization_id", clientOrgId)
            .eq("work_date", today)
            .limit(500),
          supabase
            .from("invoices")
            .select("total, currency, status")
            .eq("client_organization_id", clientOrgId)
            .in("status", ["issued", "sent", "partially_paid", "overdue"])
            .order("due_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("client_profiles")
            .select("primary_contact_name")
            .eq("organization_id", clientOrgId)
            .maybeSingle(),
          supabase
            .from("tickets")
            .select("status, sla_due_at, resolved_at, created_at")
            .eq("client_organization_id", clientOrgId)
            .not("sla_due_at", "is", null)
            .limit(200),
        ])
      : [
          { data: [] as never[], count: 0 },
          { count: 0 },
          { data: [] as never[], count: 0 },
          { data: [] as never[] },
          { data: [] as never[] },
          { data: null },
          { data: null },
          { data: [] as never[] },
        ];

  const members = teamResult.data ?? [];
  const teamCount = members.length;
  const pendingApprovals = pendingResult.count;
  const openTickets = ticketResult.data ?? [];
  const openTicketCount = ticketResult.count ?? openTickets.length;
  const attendanceRows = attendanceResult.data ?? [];
  const todayRows = todayResult.data ?? [];

  const presentToday = todayRows.filter((r) =>
    ["present", "late"].includes(r.status ?? ""),
  ).length;
  const attendanceRate =
    teamCount > 0 ? Math.round((presentToday / teamCount) * 100) : 0;

  const hoursByDay = new Map<string, number>();
  for (const row of attendanceRows) {
    if (!row.work_date) continue;
    hoursByDay.set(
      row.work_date,
      (hoursByDay.get(row.work_date) ?? 0) + (row.worked_minutes ?? 0) / 60,
    );
  }

  const chartData = Array.from({ length: 14 }, (_, i) => {
    const day = subDays(new Date(), 13 - i);
    const key = format(day, "yyyy-MM-dd");
    return {
      day: format(day, "MMM d"),
      hours: Math.round((hoursByDay.get(key) ?? 0) * 10) / 10,
      status: hoursByDay.has(key) ? "present" : "upcoming",
    };
  });

  const donutData = [
    {
      name: "Present",
      value: todayRows.filter((r) => r.status === "present").length,
      fill: "#119446",
    },
    {
      name: "On Leave",
      value: todayRows.filter((r) => r.status === "leave").length,
      fill: "#f59e0b",
    },
    {
      name: "Rest / holiday",
      value: todayRows.filter((r) =>
        ["rest_day", "holiday"].includes(r.status ?? ""),
      ).length,
      fill: "#0ea5e9",
    },
    {
      name: "Absent",
      value: todayRows.filter((r) =>
        ["absent", "incomplete", null].includes(r.status),
      ).length,
      fill: "#667085",
    },
  ];

  const latestInvoice = invoiceResult.data as {
    total: number;
    currency: string;
    status: string;
  } | null;

  const managerEmbed = managerResult.data as {
    primary_contact_name: string | null;
  } | null;

  const slaRows = slaResult.data ?? [];
  const slaPct = slaCompliancePercent(
    slaRows.map((t) => ({
      status: t.status,
      slaDueAt: t.sla_due_at,
      resolvedAt: t.resolved_at,
      createdAt: t.created_at,
    })),
  );

  return (
    <PageContainer size="wide">
      <PageHeader
        name={name}
        subtitle={`Here's the latest update on your Beepa team at ${orgName}.`}
        quote="Great partnerships create greater possibilities."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          title="Active Team Members"
          value={teamCount ?? 0}
          icon={IconUsersGroup}
        />
        <MetricCard
          title="Present Today"
          value={presentToday}
          subtitle={`${attendanceRate}% of assigned team`}
          icon={IconUsers}
        />
        <MetricCard
          title="Attendance Rate"
          value={teamCount > 0 ? `${attendanceRate}%` : "—"}
          subtitle="Today vs assigned roster"
          icon={IconClock}
        />
        <MetricCard
          title="Open Tickets"
          value={openTicketCount}
          icon={IconTicket}
        />
        <MetricCard
          title="SLA compliance"
          value={slaPct == null ? "—" : `${slaPct}%`}
          subtitle={
            slaPct == null
              ? "No tickets with SLA yet"
              : "On track / met vs breached"
          }
          icon={IconChartBar}
        />
        <MetricCard
          title="In review"
          value={pendingApprovals ?? 0}
          deltaPositive={false}
          icon={IconReportAnalytics}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Team Attendance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyAttendanceChart data={chartData} />
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Team Status Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TeamStatusDonut data={donutData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base text-navy">
              In review
            </CardTitle>
            <Button
              variant="link"
              className="h-auto p-0 text-green-strong"
              nativeButton={false}
              render={<Link href="/app/client/approvals" />}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {(pendingApprovals ?? 0) === 0 ? (
              <p className="text-sm text-slate">No timesheets awaiting your review.</p>
            ) : (
              <p className="text-sm text-navy">
                {pendingApprovals} timesheet day{pendingApprovals === 1 ? "" : "s"} awaiting
                your review
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base text-navy">
              My Team
            </CardTitle>
            <Button
              variant="link"
              className="h-auto p-0 text-green-strong"
              nativeButton={false}
              render={<Link href="/app/client/team" />}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <EmptyState
                title="Team roster not configured"
                description="Assigned team members will appear here once staffing is set up."
                className="border-0 bg-transparent py-4"
              />
            ) : (
              <ul className="divide-y divide-line">
                {members.slice(0, 4).map((member) => (
                  <li
                    key={member.employee_id ?? member.display_name}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-navy">
                        {member.display_name ?? "Team member"}
                      </p>
                      <p className="text-sm text-slate">
                        {member.role_title || member.job_title || "—"}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {(member.assignment_status ?? "active").replace(/_/g, " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Open Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openTickets.length === 0 ? (
              <EmptyState
                icon={IconTicket}
                title="No open tickets"
                className="border-0 bg-transparent py-4"
              />
            ) : (
              <ul className="space-y-3">
                {openTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/app/client/tickets/${ticket.id}`}
                      className="text-sm font-medium text-navy hover:text-green-strong"
                    >
                      {ticket.subject}
                    </Link>
                    <p className="text-xs text-slate">
                      {ticket.ticket_number} · {ticket.status.replace(/_/g, " ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Performance Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate">
              Client-visible KPIs live on the performance page once QA publishes them.
            </p>
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              nativeButton={false}
              render={<Link href="/app/client/performance" />}
            >
              Open performance
            </Button>
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Billing Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-display text-2xl font-bold text-navy">
              {latestInvoice
                ? `${latestInvoice.currency} ${Number(latestInvoice.total).toLocaleString()}`
                : "—"}
            </p>
            <p className="text-sm text-slate">Latest issued invoice</p>
            <Badge className="bg-soft-green text-green-strong capitalize">
              {latestInvoice?.status.replace(/_/g, " ") ?? "No invoice yet"}
            </Badge>
            <Button
              variant="secondary"
              className="mt-2 min-h-11 w-full"
              nativeButton={false}
              render={<Link href="/app/client/billing" />}
            >
              View billing
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="">
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Your Beepa Account Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          {managerEmbed?.primary_contact_name ? (
            <p className="text-sm text-navy">
              Primary contact: {managerEmbed.primary_contact_name}
            </p>
          ) : (
            <EmptyState
              icon={IconChartBar}
              title="Account manager not assigned"
              description="Your dedicated client success contact will appear here."
              className="border-0 bg-transparent py-4"
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
