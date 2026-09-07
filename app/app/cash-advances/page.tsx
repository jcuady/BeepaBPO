import type { Metadata } from "next";
import { format } from "date-fns";
import { IconCash } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { CashAdvanceReviewButtons } from "@/components/app/cash-advance/review-buttons";
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
import { mapPendingApprovalActability } from "@/lib/approvals/engine";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Cash Advances" };

const QUEUE_STATUSES = ["pending", "hr_review", "finance_review"] as const;
const ALL_STATUSES = [
  ...QUEUE_STATUSES,
  "approved",
  "rejected",
  "released",
  "completed",
  "cancelled",
] as const;

const REVIEWABLE = new Set<string>(QUEUE_STATUSES);

export default async function CashAdvancesQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "cash_advance.read");

  const params = await searchParams;
  const status = enumParam(params.status, ALL_STATUSES);

  const supabase = await createClient();
  let query = supabase
    .from("cash_advance_requests")
    .select(
      "id, requested_amount, status, reason, created_at, employees(employee_number, profiles(display_name))",
    )
    .order("created_at", { ascending: true })
    .limit(100);

  if (status) query = query.eq("status", status);
  else query = query.in("status", [...QUEUE_STATUSES]);

  const { data: requests } = await query;

  const canReview =
    workspace.permissions.has("cash_advance.approve") ||
    workspace.permissions.has("cash_advance.manage");

  const reviewIds = (requests ?? [])
    .filter((r) => REVIEWABLE.has(r.status))
    .map((r) => r.id);
  const actability = canReview
    ? await mapPendingApprovalActability(
        supabase,
        workspace,
        "cash_advance",
        reviewIds,
      )
    : new Map();

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="HR queue for cash advance requests."
      />

      <form method="get">
        <FilterBar showSearch={false}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status ?? ""}
            options={[
              { value: "", label: "Open queue" },
              ...ALL_STATUSES.map((s) => ({
                value: s,
                label: s.replace(/_/g, " "),
              })),
            ]}
          />
        </FilterBar>
      </form>

      {!requests?.length ? (
        <EmptyState
          icon={IconCash}
          title="No cash advances"
          description="Employee cash advance requests matching this filter will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((row) => {
                const employee = row.employees as {
                  employee_number: string;
                  profiles: { display_name: string } | null;
                } | null;
                const name =
                  employee?.profiles?.display_name ??
                  employee?.employee_number ??
                  "Employee";
                const act = actability.get(row.id);
                const showActions =
                  canReview && REVIEWABLE.has(row.status) && act?.canAct;

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium text-navy">{name}</p>
                      <p className="max-w-xs truncate text-xs text-slate">
                        {row.reason}
                      </p>
                    </TableCell>
                    <TableCell className="font-medium text-navy">
                      ₱{Number(row.requested_amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-slate">
                      {format(new Date(row.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {showActions ? (
                        <CashAdvanceReviewButtons requestId={row.id} />
                      ) : canReview &&
                        REVIEWABLE.has(row.status) &&
                        act?.stepName ? (
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
