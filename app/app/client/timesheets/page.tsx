import type { Metadata } from "next";
import { format, subDays } from "date-fns";
import { IconReceipt } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientTimesheetReviewActions } from "@/components/app/attendance/client-timesheet-review-actions";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatWorkedMinutes } from "@/lib/attendance/minutes";
import { can } from "@/lib/permissions/can";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Timesheets" };

export default async function ClientTimesheetsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();
  const from = format(subDays(new Date(), 13), "yyyy-MM-dd");

  const canReview =
    can(workspace.permissions, "attendance.approve") &&
    can(workspace.permissions, "approvals.act");

  let allowApproval = false;
  const grouped = new Map<
    string,
    { name: string; minutes: number; days: number }
  >();
  let pendingReview: {
    attendance_record_id: string;
    display_name: string | null;
    work_date: string | null;
    worked_minutes: number | null;
  }[] = [];

  if (clientOrgId) {
    const [{ data: settings }, { data }, { data: pending }] = await Promise.all([
      supabase
        .from("client_settings")
        .select("allow_timesheet_approval")
        .eq("client_organization_id", clientOrgId)
        .maybeSingle(),
      supabase
        .from("client_attendance_summary")
        .select(
          "employee_id, display_name, worked_minutes, work_date, approval_status",
        )
        .eq("client_organization_id", clientOrgId)
        .gte("work_date", from),
      supabase
        .from("client_attendance_summary")
        .select(
          "attendance_record_id, display_name, work_date, worked_minutes",
        )
        .eq("client_organization_id", clientOrgId)
        .eq("approval_status", "client_review")
        .order("work_date", { ascending: false })
        .limit(40),
    ]);

    allowApproval = Boolean(settings?.allow_timesheet_approval);
    pendingReview = (pending ?? []).filter(
      (row): row is typeof pendingReview[number] =>
        Boolean(row.attendance_record_id),
    );

    for (const row of data ?? []) {
      const key = row.employee_id ?? "unknown";
      const current = grouped.get(key) ?? {
        name: row.display_name ?? "Team member",
        minutes: 0,
        days: 0,
      };
      current.minutes += row.worked_minutes ?? 0;
      current.days += 1;
      grouped.set(key, current);
    }
  }

  const rows = Array.from(grouped.entries());
  const showActions = canReview && allowApproval;

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={
          showActions
            ? "Approve days in client review, then browse recorded hours."
            : "View recorded team hours for the last 14 days (read-only)."
        }
      />

      {showActions ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Awaiting your review ({pendingReview.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!pendingReview.length ? (
              <p className="text-sm text-slate">
                No timesheet days waiting for client approval.
              </p>
            ) : (
              pendingReview.map((row) => (
                <div
                  key={row.attendance_record_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line px-3 py-3"
                >
                  <div>
                    <p className="font-medium text-navy">
                      {row.display_name ?? "Team member"}
                    </p>
                    <p className="text-sm text-slate">
                      {row.work_date
                        ? format(new Date(`${row.work_date}T00:00:00`), "MMM d, yyyy")
                        : "—"}{" "}
                      · {formatWorkedMinutes(row.worked_minutes ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Client review</Badge>
                    <ClientTimesheetReviewActions
                      attendanceRecordId={row.attendance_record_id}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={IconReceipt}
          title="No timesheets"
          description="Hours appear here after assigned staff complete attendance days."
        />
      ) : (
        <div className="space-y-2">
          {rows.map(([id, row]) => (
            <Card key={id} className="">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">{row.name}</p>
                  <p className="text-sm text-slate">{row.days} recorded days</p>
                </div>
                <p className="font-display text-lg font-semibold text-navy">
                  {formatWorkedMinutes(row.minutes)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
