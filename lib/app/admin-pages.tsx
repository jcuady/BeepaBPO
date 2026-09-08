import Link from "next/link";
import { forbidden } from "next/navigation";
import {
  IconBriefcase,
  IconBuilding,
  IconCoin,
  IconFileText,
  IconReportAnalytics,
  IconTicket,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/app/page-container";
import { StatusBadge } from "@/components/app/status-badge";
import { ClientInviteForm } from "@/components/app/clients/client-invite-form";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { canAny } from "@/lib/permissions/can";
import { AdminOpsSmokeActions } from "@/components/app/admin/admin-ops-smoke-actions";

export async function HrPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  if (!canAny(workspace.permissions, ["employees.read", "employees.manage", "leave.read"])) {
    forbidden();
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ count }, { count: leavePending }, { count: presentToday }] =
    await Promise.all([
      supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("employment_status", "active"),
      supabase
        .from("leave_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("work_date", today)
        .in("status", ["present", "late"]),
    ]);

  const links = [
    { href: "/app/employees", label: "Employees", permission: "employees.read" },
    { href: "/app/leave", label: "Leave approvals", permission: "leave.approve" },
    { href: "/app/attendance", label: "Today's attendance", permission: "attendance.read" },
    { href: "/app/cash-advances", label: "Cash advances", permission: "cash_advance.read" },
  ].filter((link) => workspace.permissions.has(link.permission));

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Manage employees, documents, and HR workflows."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active employees" value={count ?? 0} icon={IconUsers} />
        <MetricCard title="Pending leave" value={leavePending ?? 0} icon={IconUsers} />
        <MetricCard title="Present today" value={presentToday ?? 0} icon={IconUsers} />
      </div>
      {links.length > 0 ? (
        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              HR tools
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {links.map((link) => (
              <Button
                key={link.href}
                variant="secondary"
                className="min-h-11"
                nativeButton={false}
                render={<Link href={link.href} />}
              >
                {link.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}

export async function PayrollAdminPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  if (!canAny(workspace.permissions, ["payroll.read", "payroll.manage"])) {
    forbidden();
  }

  const supabase = await createClient();
  const [{ count: periodCount }, { count: pendingCount }] = await Promise.all([
    supabase.from("payroll_periods").select("*", { count: "exact", head: true }),
    supabase
      .from("payroll_periods")
      .select("*", { count: "exact", head: true })
      .in("status", ["preparing", "review", "approval"]),
  ]);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Run payroll cycles and manage compensation."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Payroll periods" value={periodCount ?? 0} icon={IconCoin} />
        <MetricCard title="In review" value={pendingCount ?? 0} icon={IconCoin} />
      </div>
      <Card className="">
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Payroll tools
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/payroll/periods" />}
          >
            Periods
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export async function RecruitmentPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  if (!canAny(workspace.permissions, ["recruitment.read", "recruitment.manage"])) {
    forbidden();
  }

  const supabase = await createClient();
  const [{ count: jobs }, { count: applications }] = await Promise.all([
    supabase
      .from("job_posts")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("job_applications").select("*", { count: "exact", head: true }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Manage applicants, pipelines, and hiring."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Published jobs" value={jobs ?? 0} icon={IconUsers} />
        <MetricCard title="Applications" value={applications ?? 0} icon={IconUsers} />
      </div>
      <Card className="">
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Recruitment tools
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/recruitment/jobs" />}
          >
            Job posts
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/recruitment/applicants" />}
          >
            Applicants
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export async function CrmPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  if (!canAny(workspace.permissions, ["crm.read", "crm.manage"])) {
    forbidden();
  }

  const supabase = await createClient();
  const [{ count: leadCount }, { count: dealCount }, { count: proposalCount }] =
    await Promise.all([
      supabase.from("crm_leads").select("*", { count: "exact", head: true }),
      supabase.from("crm_deals").select("*", { count: "exact", head: true }),
      supabase.from("crm_proposals").select("*", { count: "exact", head: true }),
    ]);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Track leads, opportunities, and client relationships."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Leads" value={leadCount ?? 0} icon={IconBuilding} />
        <MetricCard title="Deals" value={dealCount ?? 0} icon={IconBriefcase} />
        <MetricCard
          title="Proposals"
          value={proposalCount ?? 0}
          icon={IconFileText}
        />
      </div>
      <Card className="">
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">CRM tools</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/crm/leads" />}
          >
            Leads
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/crm/deals" />}
          >
            Deals
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/crm/proposals" />}
          >
            Proposals
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export async function ClientsAdminPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  if (!canAny(workspace.permissions, ["clients.read", "clients.manage"])) {
    forbidden();
  }

  const canManage = workspace.permissions.has("clients.manage");
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("type", "client")
    .order("name");

  const orgIds = (orgs ?? []).map((o) => o.id);
  const { data: memberships } =
    canManage && orgIds.length > 0
      ? await supabase
          .from("organization_memberships")
          .select(
            "id, status, membership_type, organization_id, profiles:user_id(display_name, first_name, last_name), organizations(name, type), membership_roles(roles(name, code))",
          )
          .eq("membership_type", "client")
          .in("organization_id", orgIds)
          .in("status", ["active", "invited"])
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: null };

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Manage client organizations and portal invites."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Client organizations"
          value={orgs?.length ?? 0}
          icon={IconBuilding}
        />
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Invite client user
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClientInviteForm
              organizations={(orgs ?? [])
                .filter((o) => o.status === "active")
                .map((o) => ({ id: o.id, name: o.name }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {!orgs?.length ? (
        <EmptyState
          icon={IconBuilding}
          title="No client organizations"
          description="Client accounts will appear here after onboarding."
        />
      ) : (
        <div className="space-y-2">
          {orgs.map((org) => (
            <Card key={org.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-navy">{org.name}</p>
                  <p className="text-sm text-slate">{org.slug}</p>
                </div>
                <span className="text-sm capitalize text-slate">
                  {org.status}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canManage && memberships?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Client portal members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberships.map((row) => {
              const profile = Array.isArray(row.profiles)
                ? row.profiles[0]
                : row.profiles;
              const org = Array.isArray(row.organizations)
                ? row.organizations[0]
                : row.organizations;
              const role = row.membership_roles?.[0]?.roles;
              const roleRow = Array.isArray(role) ? role[0] : role;
              const name =
                profile?.display_name ||
                [profile?.first_name, profile?.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                "—";
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-navy">{name}</p>
                    <p className="text-sm text-slate">
                      {org?.name ?? "—"}
                      {roleRow?.name ? ` · ${roleRow.name}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}

export async function ReportsAdminPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  if (!canAny(workspace.permissions, ["reports.read", "reports.export"])) {
    forbidden();
  }

  const canExport = workspace.permissions.has("reports.export");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [
    { count: employees },
    { count: present },
    { count: tickets },
    { count: leads },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("employment_status", "active"),
    supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("work_date", today)
      .in("status", ["present", "late"]),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(resolved,closed)"),
    supabase.from("crm_leads").select("*", { count: "exact", head: true }),
  ]);

  const exportLinks = [
    { dataset: "snapshot", label: "Snapshot metrics" },
    { dataset: "employees", label: "Active employees" },
    { dataset: "attendance", label: "Present today" },
    { dataset: "tickets", label: "Open tickets" },
    { dataset: "leads", label: "CRM leads" },
  ] as const;

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Operational snapshot across workforce, tickets, and CRM."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active employees" value={employees ?? 0} icon={IconUsers} />
        <MetricCard title="Present today" value={present ?? 0} icon={IconReportAnalytics} />
        <MetricCard title="Open tickets" value={tickets ?? 0} icon={IconTicket} />
        <MetricCard title="CRM leads" value={leads ?? 0} icon={IconBuilding} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            CSV export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canExport ? (
            <>
              <p className="text-sm text-slate">
                Downloads respect your row-level access. Up to 2,000 rows per
                file.
              </p>
              <div className="flex flex-wrap gap-3">
                {exportLinks.map((link) => (
                  <Button
                    key={link.dataset}
                    variant="secondary"
                    className="min-h-11"
                    nativeButton={false}
                    render={
                      <a href={`/app/reports/export?dataset=${link.dataset}`} />
                    }
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate">
              Snapshot is view-only for your role. CSV export needs the{" "}
              <span className="font-medium text-navy">reports.export</span>{" "}
              permission.
            </p>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export async function AdminPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "system.manage");

  const supabase = await createClient();
  const [
    { count: userCount },
    { count: orgCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*", { count: "exact", head: true }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="System administration and configuration."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="User profiles"
          value={userCount ?? 0}
          icon={IconUsers}
        />
        <MetricCard
          title="Organizations"
          value={orgCount ?? 0}
          icon={IconBuilding}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Admin tools
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/admin/users" />}
          >
            Users
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/admin/organizations" />}
          >
            Organizations
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app/admin/audit" />}
          >
            Audit log
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Ops smoke
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate">
            Dry-run counts cron work without notifying users or marking invoices
            overdue. Test push sends an in-app (and push if subscribed) alert to
            you.
          </p>
          <AdminOpsSmokeActions />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export async function OwnerDashboardPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "system.manage");

  const supabase = await createClient();
  const [
    { count: members },
    { count: pendingApprovals },
    { count: clientOrgs },
    { count: openTickets },
  ] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .eq("type", "client"),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(resolved,closed)"),
  ]);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Organization-wide overview and key metrics."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active memberships"
          value={members ?? 0}
          icon={IconUsers}
        />
        <MetricCard
          title="Pending approvals"
          value={pendingApprovals ?? 0}
          icon={IconReportAnalytics}
        />
        <MetricCard
          title="Client orgs"
          value={clientOrgs ?? 0}
          icon={IconBuilding}
        />
        <MetricCard title="Open tickets" value={openTickets ?? 0} icon={IconTicket} />
      </div>
      <Card className="">
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Jump in
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(
            [
              {
                href: "/app/approvals",
                label: "Approvals",
                show:
                  workspace.permissions.has("leave.approve") ||
                  workspace.permissions.has("cash_advance.approve") ||
                  workspace.permissions.has("cash_advance.manage") ||
                  workspace.permissions.has("tickets.manage") ||
                  workspace.permissions.has("payroll.manage") ||
                  workspace.permissions.has("payroll.approve"),
              },
              {
                href: "/app/payroll/periods",
                label: "Payroll periods",
                show:
                  workspace.permissions.has("payroll.read") ||
                  workspace.permissions.has("payroll.manage"),
              },
              {
                href: "/app/admin/users",
                label: "Users",
                show: workspace.permissions.has("system.manage"),
              },
              {
                href: "/app/admin/audit",
                label: "Audit log",
                show: workspace.permissions.has("system.manage"),
              },
              {
                href: "/app/employees",
                label: "Employees",
                show: workspace.permissions.has("employees.read"),
              },
              {
                href: "/app/tickets",
                label: "Tickets",
                show: workspace.permissions.has("tickets.read"),
              },
              {
                href: "/app/reports",
                label: "Reports",
                show:
                  workspace.permissions.has("reports.read") ||
                  workspace.permissions.has("reports.export"),
              },
            ] as const
          )
            .filter((link) => link.show)
            .map((link) => (
              <Button
                key={link.href}
                variant="secondary"
                className="min-h-11"
                nativeButton={false}
                render={<Link href={link.href} />}
              >
                {link.label}
              </Button>
            ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
