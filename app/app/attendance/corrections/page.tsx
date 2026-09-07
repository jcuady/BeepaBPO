import type { Metadata } from "next";
import { format } from "date-fns";
import { IconClockEdit } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { CorrectionReviewActions } from "@/components/app/attendance/correction-review-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { PageContainer } from "@/components/app/page-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { enumParam } from "@/lib/app/search-params";
import { canAny } from "@/lib/permissions/can";
import { mapPendingApprovalActability } from "@/lib/approvals/engine";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Attendance Corrections" };

const STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

export default async function AttendanceCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  if (
    !canAny(workspace.permissions, [
      "attendance.approve",
      "attendance.correct",
      "attendance.manage",
    ])
  ) {
    requirePermission(workspace, "attendance.approve");
  }

  const params = await searchParams;
  const status = enumParam(params.status, STATUSES, "pending") ?? "pending";

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("attendance_correction_requests")
    .select(
      "id, reason, status, requested_clock_in_at, requested_clock_out_at, created_at, employees(employee_number, job_title, profiles(display_name)), attendance_records(work_date, clock_in_at, clock_out_at)",
    )
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100);

  const pendingIds =
    status === "pending" ? (requests ?? []).map((r) => r.id) : [];
  const actability = await mapPendingApprovalActability(
    supabase,
    workspace,
    "attendance_correction",
    pendingIds,
  );

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Review attendance correction requests."
      />

      <form method="get">
        <FilterBar showSearch={false}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status}
            options={STATUSES.map((s) => ({
              value: s,
              label: s.replace(/_/g, " "),
            }))}
          />
        </FilterBar>
      </form>

      {!requests?.length ? (
        <EmptyState
          icon={IconClockEdit}
          title={`No ${status.replace(/_/g, " ")} corrections`}
          description="Employee correction requests matching this filter will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Requested times</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                {status === "pending" ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => {
                const employee = req.employees as {
                  job_title: string;
                  employee_number: string;
                  profiles: { display_name: string } | null;
                } | null;
                const record = req.attendance_records as {
                  work_date: string;
                  clock_in_at: string | null;
                  clock_out_at: string | null;
                } | null;
                const name =
                  employee?.profiles?.display_name ??
                  employee?.employee_number ??
                  "Employee";
                const act = actability.get(req.id);
                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium text-navy">
                      {name}
                      <p className="text-xs font-normal text-slate">
                        {employee?.job_title}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-slate">
                      {record?.work_date
                        ? format(new Date(record.work_date), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate">
                      <div>
                        In:{" "}
                        {req.requested_clock_in_at
                          ? format(
                              new Date(req.requested_clock_in_at),
                              "HH:mm",
                            )
                          : "—"}
                      </div>
                      <div>
                        Out:{" "}
                        {req.requested_clock_out_at
                          ? format(
                              new Date(req.requested_clock_out_at),
                              "HH:mm",
                            )
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm text-slate">
                      {req.reason}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={req.status} />
                    </TableCell>
                    {status === "pending" ? (
                      <TableCell>
                        {act?.canAct ? (
                          <CorrectionReviewActions
                            correctionRequestId={req.id}
                          />
                        ) : act?.stepName ? (
                          <span className="text-xs text-slate">
                            Waiting for {act.stepName}
                          </span>
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
        </div>
      )}
    </PageContainer>
  );
}
