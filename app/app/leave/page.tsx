import type { Metadata } from "next";
import { format } from "date-fns";
import { IconCalendarEvent } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { LeaveApprovalActions } from "@/components/app/leave/leave-approval-actions";
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
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { enumParam } from "@/lib/app/search-params";
import { mapPendingApprovalActability } from "@/lib/approvals/engine";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Leave Approvals" };

const STATUSES = [
  "pending",
  "manager_approved",
  "hr_approved",
  "approved",
  "rejected",
  "cancelled",
] as const;

export default async function LeaveApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "leave.approve");

  const params = await searchParams;
  const status = enumParam(params.status, STATUSES, "pending") ?? "pending";

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("leave_requests")
    .select(
      "id, start_at, end_at, status, reason, employees(job_title, employee_number, profiles(display_name)), leave_types(name)",
    )
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100);

  const actionableIds = (requests ?? [])
    .filter((r) => r.status === "pending" || r.status === "manager_approved")
    .map((r) => r.id);
  const actability = await mapPendingApprovalActability(
    supabase,
    workspace,
    "leave_request",
    actionableIds,
  );

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Review and action leave requests."
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
          icon={IconCalendarEvent}
          title={`No ${status.replace(/_/g, " ")} leave requests`}
          description="Requests matching this filter will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => {
                const employee = req.employees as {
                  job_title: string;
                  employee_number: string;
                  profiles: { display_name: string } | null;
                } | null;
                const leaveType = req.leave_types as { name: string } | null;
                const name =
                  employee?.profiles?.display_name ??
                  employee?.employee_number ??
                  "Employee";
                const act = actability.get(req.id);
                const showActions =
                  (req.status === "pending" ||
                    req.status === "manager_approved") &&
                  act?.canAct;

                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <p className="font-medium text-navy">{name}</p>
                      <p className="text-xs text-slate">
                        {leaveType?.name ?? "Leave"}
                        {req.reason ? ` · ${req.reason}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-slate">
                      {format(new Date(req.start_at), "MMM d")} –{" "}
                      {format(new Date(req.end_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={req.status} />
                    </TableCell>
                    <TableCell>
                      {showActions ? (
                        <LeaveApprovalActions leaveRequestId={req.id} />
                      ) : act?.stepName &&
                        (req.status === "pending" ||
                          req.status === "manager_approved") ? (
                        <span className="text-xs text-slate">
                          Waiting for {act.stepName}
                        </span>
                      ) : (
                        <span className="text-xs text-slate">—</span>
                      )}
                    </TableCell>
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
