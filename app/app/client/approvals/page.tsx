import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconChecks } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientTimesheetReviewActions } from "@/components/app/attendance/client-timesheet-review-actions";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { formatWorkedMinutes } from "@/lib/attendance/minutes";
import { can } from "@/lib/permissions/can";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Approvals" };

export default async function ClientApprovalsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  const canReview =
    can(workspace.permissions, "attendance.approve") &&
    can(workspace.permissions, "approvals.act");

  let allowApproval = false;
  let pending: {
    attendance_record_id: string;
    display_name: string | null;
    work_date: string | null;
    worked_minutes: number | null;
  }[] = [];

  if (clientOrgId) {
    const [{ data: settings }, { data }] = await Promise.all([
      supabase
        .from("client_settings")
        .select("allow_timesheet_approval")
        .eq("client_organization_id", clientOrgId)
        .maybeSingle(),
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
    pending = (data ?? []).filter(
      (row): row is (typeof pending)[number] =>
        Boolean(row.attendance_record_id),
    );
  }

  const showActions = canReview && allowApproval;

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={
          showActions
            ? "Approve or send back timesheet days Beepa submitted for your review."
            : "Timesheet approval is off or your role is view-only. Contact Beepa to enable."
        }
      />
      {!pending.length ? (
        <EmptyState
          icon={IconChecks}
          title="Nothing awaiting review"
          description="When Beepa submits timesheet days for client approval, they appear here."
        />
      ) : (
        <div className="space-y-2">
          {pending.map((item) => (
            <Card key={item.attendance_record_id} className="">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">
                    Timesheet · {item.display_name ?? "Team member"}
                  </p>
                  <p className="text-sm text-slate">
                    {item.work_date
                      ? format(
                          new Date(`${item.work_date}T00:00:00`),
                          "MMM d, yyyy",
                        )
                      : "—"}{" "}
                    · {formatWorkedMinutes(item.worked_minutes ?? 0)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Client review</Badge>
                  {showActions ? (
                    <ClientTimesheetReviewActions
                      attendanceRecordId={item.attendance_record_id}
                    />
                  ) : (
                    <Button
                      variant="link"
                      className="h-auto p-0 text-green-strong"
                      nativeButton={false}
                      render={<Link href="/app/client/timesheets" />}
                    >
                      View timesheets
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
