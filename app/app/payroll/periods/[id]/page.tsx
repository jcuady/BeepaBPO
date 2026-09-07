import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { RecalculatePayrollButton } from "@/components/app/payroll/recalculate-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { IconCoin } from "@tabler/icons-react";

export const metadata: Metadata = { title: "Payroll Period" };

export default async function PayrollPeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "payroll.read");

  const supabase = await createClient();
  const [{ data: period }, { data: records }] = await Promise.all([
    supabase.from("payroll_periods").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("payroll_records")
      .select(
        "id, status, basic_pay, gross_pay, net_pay, employees(employee_number, profiles(display_name))",
      )
      .eq("payroll_period_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  if (!period) notFound();

  const canManage = can(workspace.permissions, "payroll.manage");

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={period.name}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-display text-base text-navy">
              {period.name}
            </CardTitle>
            <Badge variant="outline" className="capitalize">
              {period.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-slate">
          {format(new Date(period.start_date), "MMM d")} –{" "}
          {format(new Date(period.end_date), "MMM d, yyyy")} · Pay{" "}
          {format(new Date(period.pay_date), "MMM d, yyyy")}
        </CardContent>
      </Card>

      {!records?.length ? (
        <EmptyState
          icon={IconCoin}
          title="No payroll records"
          description="Records for this period will appear here."
        />
      ) : (
        <div className="space-y-2">
          {records.map((row) => {
            const emp = row.employees as {
              employee_number: string;
              profiles: { display_name: string } | null;
            } | null;
            const name =
              emp?.profiles?.display_name ?? emp?.employee_number ?? "Employee";
            return (
              <Card key={row.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-navy">{name}</p>
                    <p className="text-sm text-slate">
                      Gross {Number(row.gross_pay ?? 0).toLocaleString()} · Net{" "}
                      {Number(row.net_pay ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {row.status}
                    </Badge>
                    {canManage ? (
                      <RecalculatePayrollButton payrollRecordId={row.id} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Link
        href="/app/payroll/periods"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to periods
      </Link>
    </PageContainer>
  );
}
