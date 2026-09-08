import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { RecalculatePayrollButton } from "@/components/app/payroll/recalculate-button";
import { SubmitPayrollApprovalButton } from "@/components/app/payroll/submit-approval-button";
import { PayrollPeriodReviewButtons } from "@/components/app/payroll/period-review-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { mapPendingApprovalActability } from "@/lib/approvals/engine";
import { IconCoin } from "@tabler/icons-react";

export const metadata: Metadata = { title: "Payroll Period" };

const SUBMITTABLE = new Set(["draft", "preparing", "review"]);

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
  const canManage = can(workspace.permissions, "payroll.manage");
  const canReview =
    canManage || can(workspace.permissions, "payroll.approve");

  const [{ data: period }, { data: records }, actability] = await Promise.all([
    supabase.from("payroll_periods").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("payroll_records")
      .select(
        "id, status, basic_pay, gross_pay, net_pay, employees(employee_number, profiles(display_name))",
      )
      .eq("payroll_period_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    canReview
      ? mapPendingApprovalActability(supabase, workspace, "payroll_period", [
          id,
        ])
      : Promise.resolve(new Map()),
  ]);

  if (!period) notFound();

  const act = actability.get(id);
  // Hide submit whenever a pending approval row exists for this period.
  const showSubmit =
    canManage && SUBMITTABLE.has(period.status) && !act;
  const showReview = period.status === "approval" && act?.canAct;
  const waitingLabel =
    period.status === "approval" && act?.stepName && !act.canAct
      ? `Waiting for ${act.stepName}`
      : period.status === "approval" && !act
        ? "Approval pending"
        : null;

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
        <CardContent className="space-y-4 text-sm text-slate">
          <p>
            {format(new Date(period.start_date), "MMM d")} –{" "}
            {format(new Date(period.end_date), "MMM d, yyyy")} · Pay{" "}
            {format(new Date(period.pay_date), "MMM d, yyyy")}
          </p>
          {showSubmit ? (
            <SubmitPayrollApprovalButton payrollPeriodId={id} />
          ) : null}
          {showReview ? (
            <div className="space-y-2">
              {act?.stepName ? (
                <p className="text-xs font-medium uppercase tracking-wide text-slate">
                  Current step: {act.stepName}
                </p>
              ) : null}
              <PayrollPeriodReviewButtons payrollPeriodId={id} />
            </div>
          ) : null}
          {waitingLabel ? (
            <p className="text-xs text-slate">{waitingLabel}</p>
          ) : null}
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
                    {canManage && SUBMITTABLE.has(period.status) ? (
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
