import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconCoin } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";
import { CreatePayrollPeriodForm } from "@/components/app/payroll/create-period-form";

export const metadata: Metadata = { title: "Payroll Periods" };

export default async function PayrollPeriodsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "payroll.read");

  const canManage = can(workspace.permissions, "payroll.manage");
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("payroll_periods")
    .select("id, name, start_date, end_date, pay_date, status, created_at")
    .order("start_date", { ascending: false })
    .limit(24);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Open payroll cycles and review employee draft records."
      />

      {canManage ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Create period</CardTitle>
          </CardHeader>
          <CardContent>
            <CreatePayrollPeriodForm />
          </CardContent>
        </Card>
      ) : null}

      {!periods?.length ? (
        <EmptyState
          icon={IconCoin}
          title="No payroll periods"
          description={
            canManage
              ? "Use Create period above to open the first cycle."
              : "Ask finance to open a period, or use seed data in demo environments."
          }
        />
      ) : (
        <div className="space-y-2">
          {periods.map((period) => (
            <Card key={period.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Link
                  href={`/app/payroll/periods/${period.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="font-medium text-navy">{period.name}</p>
                  <p className="text-sm text-slate">
                    {format(new Date(period.start_date), "MMM d")} –{" "}
                    {format(new Date(period.end_date), "MMM d, yyyy")} · Pay{" "}
                    {format(new Date(period.pay_date), "MMM d, yyyy")}
                  </p>
                </Link>
                <Badge variant="outline" className="capitalize">
                  {period.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
