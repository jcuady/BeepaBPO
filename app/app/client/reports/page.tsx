import type { Metadata } from "next";
import { format, subDays } from "date-fns";
import { IconReportAnalytics } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { EmptyState } from "@/components/app/empty-state";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Reports" };

export default async function ClientReportsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();
  const from = format(subDays(new Date(), 13), "yyyy-MM-dd");

  let teamCount = 0;
  let daysRecorded = 0;
  let minutes = 0;

  if (clientOrgId) {
    const [{ count }, { data: attendance }] = await Promise.all([
      supabase
        .from("client_visible_employees")
        .select("*", { count: "exact", head: true })
        .eq("client_organization_id", clientOrgId),
      supabase
        .from("client_attendance_summary")
        .select("worked_minutes, work_date")
        .eq("client_organization_id", clientOrgId)
        .gte("work_date", from)
        // ponytail: aggregate sample; replace with RPC COUNT/SUM when needed
        .limit(2000),
    ]);
    teamCount = count ?? 0;
    const rows = attendance ?? [];
    daysRecorded = new Set(rows.map((r) => r.work_date).filter(Boolean)).size;
    minutes = rows.reduce((sum, row) => sum + (row.worked_minutes ?? 0), 0);
  }

  const hours = Math.round((minutes / 60) * 10) / 10;

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Attendance, timesheet, and roster snapshot for the last 14 days."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Assigned team" value={teamCount} icon={IconReportAnalytics} />
        <MetricCard title="Recorded days" value={daysRecorded} icon={IconReportAnalytics} />
        <MetricCard title="Hours logged" value={hours} icon={IconReportAnalytics} />
      </div>
      {teamCount === 0 ? (
        <EmptyState
          title="No reports available"
          description="Reports populate once your Beepa team is assigned."
        />
      ) : null}
    </PageContainer>
  );
}
