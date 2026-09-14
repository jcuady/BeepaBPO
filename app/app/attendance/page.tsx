import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { StatusBadge } from "@/components/app/status-badge";
import { AttendanceHeatmap } from "@/components/app/attendance/attendance-heatmap";
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
import { PageContainer } from "@/components/app/page-container";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { SubmitForClientReviewButton } from "@/components/app/attendance/submit-for-client-review-button";
import { can, canAny } from "@/lib/permissions/can";
import {
  stringParam,
  enumParam,
  ilikePattern,
  pageParam,
} from "@/lib/app/search-params";
import {
  HEATMAP_FILTERS,
  cellKind,
  recordKey,
  rowMatchesFilter,
  shiftWeek,
  weekDates,
  weekStartParam,
  type AttendanceStatus,
  type HeatmapFilter,
} from "@/lib/attendance/heatmap";

export const metadata: Metadata = { title: "Attendance" };

const PAGE_SIZE = 50;

type EmployeeRow = {
  id: string;
  employee_number: string;
  job_title: string | null;
  profiles: {
    display_name: string;
    first_name: string;
    last_name: string;
  } | null;
};

function displayName(emp: EmployeeRow): string {
  const profile = emp.profiles;
  return (
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    emp.employee_number
  );
}

export default async function AttendanceAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "attendance.read");

  const params = await searchParams;
  const q = stringParam(params.q);
  const page = pageParam(params.page);
  const week = weekStartParam(params.week);
  const status = enumParam(params.status, HEATMAP_FILTERS, "all") ?? "all";
  const heatmapOn = stringParam(params.heatmap, "1") !== "0";
  const pattern = q ? ilikePattern(q) : undefined;
  const dates = weekDates(week);
  const weekEnd = dates[6] ?? week;

  const supabase = await createClient();
  const canManage = can(workspace.permissions, "attendance.manage");
  const canSubmit = canAny(workspace.permissions, [
    "attendance.approve",
    "attendance.manage",
    "attendance.correct",
  ]);

  let empQuery = supabase
    .from("employees")
    .select(
      "id, employee_number, job_title, employment_status, profiles(display_name, first_name, last_name)",
    )
    .eq("employment_status", "active")
    .order("employee_number")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (pattern) {
    const { data: profileMatches } = await supabase
      .from("profiles")
      .select("id")
      .or(
        `display_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`,
      )
      .limit(200);
    const profileIds = (profileMatches ?? []).map((p) => p.id);
    empQuery = profileIds.length
      ? empQuery.or(
          `employee_number.ilike.${pattern},job_title.ilike.${pattern},profile_id.in.(${profileIds.join(",")})`,
        )
      : empQuery.or(
          `employee_number.ilike.${pattern},job_title.ilike.${pattern}`,
        );
  }

  const { data: employeeRows } = await empQuery;
  const employees = (employeeRows ?? []) as EmployeeRow[];
  const employeeIds = employees.map((e) => e.id);

  const { data: recordRows } = employeeIds.length
    ? await supabase
        .from("attendance_records")
        .select(
          "id, employee_id, work_date, status, approval_status, clock_in_at, clock_out_at, worked_minutes",
        )
        .in("employee_id", employeeIds)
        .gte("work_date", week)
        .lte("work_date", weekEnd)
        .limit(PAGE_SIZE * 7)
    : { data: [] as never[] };

  const records = recordRows ?? [];
  const recordMap = new Map(
    records.map((row) => [recordKey(row.employee_id, row.work_date), row]),
  );

  const visibleEmployees = employees.filter((emp) => {
    const kinds = dates.map((date) =>
      cellKind(recordMap.get(recordKey(emp.id, date))?.status as AttendanceStatus | undefined),
    );
    return rowMatchesFilter(kinds, status as HeatmapFilter);
  });

  const heatmapEmployees = visibleEmployees.map((emp) => ({
    id: emp.id,
    name: displayName(emp),
    title: emp.job_title,
  }));

  const filterQuery = {
    q,
    status: status === "all" ? undefined : status,
    week,
    heatmap: heatmapOn ? undefined : "0",
  };

  const weekLabel = `${format(parseISO(week), "MMM d")} – ${format(parseISO(weekEnd), "MMM d, yyyy")}`;

  return (
    <PageContainer>
      <RealtimeRefresh tables={[{ table: "attendance_records" }]} />
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={`Team attendance · ${weekLabel}`}
      />

      <form method="get">
        {heatmapOn ? null : <input type="hidden" name="heatmap" value="0" />}
        <FilterBar
          placeholder="Name, role, or employee number…"
          defaultValue={q}
        >
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status}
            options={[
              { value: "all", label: "All rows" },
              { value: "present", label: "Present" },
              { value: "late", label: "Late" },
              { value: "absent", label: "Absent" },
              { value: "empty", label: "Empty" },
              { value: "incomplete", label: "Incomplete" },
              { value: "off", label: "Off" },
            ]}
          />
          <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate">
            <span>Week of</span>
            <input
              type="date"
              name="week"
              defaultValue={week}
              className="min-h-11 rounded-[12px] border border-line bg-mist/50 px-3 text-sm text-navy"
            />
          </label>
          <Link
            href={`?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(status !== "all" ? { status } : {}),
              week,
              ...(heatmapOn ? { heatmap: "0" } : {}),
            }).toString()}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-navy hover:text-green-strong"
          >
            {heatmapOn ? "Hide heatmap" : "Show heatmap"}
          </Link>
        </FilterBar>
      </form>

      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href={`?${new URLSearchParams({
            ...(q ? { q } : {}),
            ...(status !== "all" ? { status } : {}),
            week: shiftWeek(week, -1),
            ...(heatmapOn ? {} : { heatmap: "0" }),
          }).toString()}`}
          className="inline-flex min-h-11 items-center font-medium text-green-strong hover:underline"
        >
          Previous week
        </Link>
        <Link
          href={`?${new URLSearchParams({
            ...(q ? { q } : {}),
            ...(status !== "all" ? { status } : {}),
            week: shiftWeek(week, 1),
            ...(heatmapOn ? {} : { heatmap: "0" }),
          }).toString()}`}
          className="inline-flex min-h-11 items-center font-medium text-green-strong hover:underline"
        >
          Next week
        </Link>
      </nav>

      {heatmapOn ? (
        heatmapEmployees.length === 0 ? (
          <EmptyState
            icon={IconClock}
            title="No employees in this view"
            description="Try another search, status, or week."
          />
        ) : (
          <AttendanceHeatmap
            employees={heatmapEmployees}
            dates={dates}
            records={records.map((row) => ({
              id: row.id,
              employee_id: row.employee_id,
              work_date: row.work_date,
              status: row.status,
              clock_in_at: row.clock_in_at,
              clock_out_at: row.clock_out_at,
              approval_status: row.approval_status,
            }))}
            canManage={canManage}
          />
        )
      ) : null}

      <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
        {!records.length ? (
          <EmptyState
            icon={IconClock}
            title="No clock records this week"
            description={
              canManage
                ? "Click a heatmap cell to add attendance, or wait for clock-ins."
                : "Employee clock-ins this week will appear here."
            }
            className="border-0"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
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
                const emp = employees.find((e) => e.id === row.employee_id);
                const name = emp ? displayName(emp) : "—";
                const canSend =
                  canSubmit &&
                  row.approval_status !== "client_review" &&
                  row.approval_status !== "finalized";
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium text-navy">{name}</p>
                      <p className="text-xs text-slate">
                        {emp?.job_title ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-slate">
                      {format(parseISO(row.work_date), "EEE d")}
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
      </div>

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={employees.length}
        query={filterQuery}
      />
    </PageContainer>
  );
}
