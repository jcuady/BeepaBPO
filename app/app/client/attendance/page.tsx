import type { Metadata } from "next";
import { format, subDays } from "date-fns";
import { IconClock } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
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
import { Input } from "@/components/ui/input";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatWorkedMinutes } from "@/lib/attendance/minutes";
import { enumParam, dateParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Attendance" };

const STATUSES = [
  "present",
  "late",
  "absent",
  "leave",
  "rest_day",
  "holiday",
  "incomplete",
] as const;

export default async function ClientAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const params = await searchParams;
  const from =
    dateParam(params.from) ?? format(subDays(new Date(), 13), "yyyy-MM-dd");
  const to = dateParam(params.to);
  const status = enumParam(params.status, STATUSES);

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  let rows: {
    employee_id: string | null;
    display_name: string | null;
    work_date: string | null;
    clock_in_at: string | null;
    clock_out_at: string | null;
    worked_minutes: number | null;
    status: string | null;
  }[] = [];

  if (clientOrgId) {
    let query = supabase
      .from("client_attendance_summary")
      .select(
        "employee_id, display_name, work_date, clock_in_at, clock_out_at, worked_minutes, status",
      )
      .eq("client_organization_id", clientOrgId)
      .gte("work_date", from)
      .order("work_date", { ascending: false })
      .limit(100);

    if (to) query = query.lte("work_date", to);
    if (status) query = query.eq("status", status);

    const { data } = await query;
    rows = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Monitor team attendance and exceptions."
      />

      <form method="get">
        <FilterBar showSearch={false}>
          <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate">
            <span>From</span>
            <Input
              type="date"
              name="from"
              defaultValue={from}
              className="min-h-11"
            />
          </label>
          <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate">
            <span>To</span>
            <Input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="min-h-11"
            />
          </label>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({
                value: s,
                label: s.replace(/_/g, " "),
              })),
            ]}
          />
        </FilterBar>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={IconClock}
          title="No attendance data"
          description="Team attendance summaries will appear here as your assigned staff clock in."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team member</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.employee_id}-${row.work_date}`}>
                  <TableCell className="font-medium text-navy">
                    {row.display_name ?? "Team member"}
                  </TableCell>
                  <TableCell className="text-slate">
                    {row.work_date
                      ? format(
                          new Date(`${row.work_date}T00:00:00`),
                          "MMM d, yyyy",
                        )
                      : "—"}
                  </TableCell>
                  <TableCell className="text-slate">
                    {formatWorkedMinutes(row.worked_minutes ?? 0)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status ?? "incomplete"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
