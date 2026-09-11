import type { Metadata } from "next";
import { format } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconClock } from "@tabler/icons-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/app/page-container";
import { SubmitForClientReviewButton } from "@/components/app/attendance/submit-for-client-review-button";
import { canAny } from "@/lib/permissions/can";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendanceAdminPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "attendance.read");

  const today = format(new Date(), "yyyy-MM-dd");
  const supabase = await createClient();
  const canSubmit = canAny(workspace.permissions, [
    "attendance.approve",
    "attendance.manage",
    "attendance.correct",
  ]);

  const { data: records } = await supabase
    .from("attendance_records")
    .select(
      "id, work_date, status, approval_status, clock_in_at, clock_out_at, worked_minutes, employees(employee_number, job_title, profiles(display_name))",
    )
    .eq("work_date", today)
    .order("clock_in_at", { ascending: true, nullsFirst: false });

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={`Today's attendance — ${format(new Date(), "MMMM d, yyyy")}`}
      />

      <Card className="">
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Summary ({records?.length ?? 0} records)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-0">
          {!records?.length ? (
            <EmptyState
              icon={IconClock}
              title="No attendance records today"
              description="Employee clock-ins will appear here throughout the day."
              className="border-0"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Clock in</TableHead>
                  <TableHead>Clock out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  {canSubmit ? <TableHead>Client</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((row) => {
                  const employee = row.employees as {
                    employee_number: string;
                    job_title: string;
                    profiles: { display_name: string } | null;
                  } | null;
                  const name =
                    employee?.profiles?.display_name ??
                    employee?.employee_number ??
                    "—";
                  const canSend =
                    canSubmit &&
                    row.approval_status !== "client_review" &&
                    row.approval_status !== "finalized";
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-navy">{name}</p>
                          <p className="text-xs text-slate">
                            {employee?.job_title ?? "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.clock_in_at
                          ? format(new Date(row.clock_in_at), "h:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {row.clock_out_at
                          ? format(new Date(row.clock_out_at), "h:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {Math.round((row.worked_minutes / 60) * 10) / 10}h
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.approval_status} />
                      </TableCell>
                      {canSubmit ? (
                        <TableCell>
                          {canSend ? (
                            <SubmitForClientReviewButton
                              attendanceRecordId={row.id}
                            />
                          ) : (
                            <span className="text-xs text-slate">—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
