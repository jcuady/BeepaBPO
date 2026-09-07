import type { Metadata } from "next";
import Link from "next/link";
import { IconChartBar } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Performance" };

export default async function ClientPerformancePage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  let kpis: {
    id: string;
    label: string;
    target_value: number | null;
    actual_value: number | null;
  }[] = [];

  if (clientOrgId) {
    const { data: members } = await supabase
      .from("client_visible_employees")
      .select("employee_id")
      .eq("client_organization_id", clientOrgId);
    const ids = (members ?? [])
      .map((m) => m.employee_id)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      const { data } = await supabase
        .from("performance_kpis")
        .select("id, label, target_value, actual_value")
        .in("employee_id", ids)
        .in("visibility", ["client_visible", "public"])
        .limit(20);
      kpis = data ?? [];
    }
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Track team productivity and quality metrics."
      />
      {kpis.length === 0 ? (
        <EmptyState
          icon={IconChartBar}
          title="No performance data"
          description="Client-visible KPIs will appear once QA reviews are recorded."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {kpis.map((kpi) => {
            const target = Number(kpi.target_value ?? 0);
            const actual = Number(kpi.actual_value ?? 0);
            const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
            return (
              <Card
                key={kpi.id}
                className=""
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-navy">{kpi.label}</p>
                    <p className="text-sm text-slate">{pct}%</p>
                  </div>
                  <Progress value={pct} className="h-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-sm text-slate">
        Need a deeper cut? Open{" "}
        <Link href="/app/client/reports" className="font-medium text-green-strong">
          reports
        </Link>
        .
      </p>
    </PageContainer>
  );
}
