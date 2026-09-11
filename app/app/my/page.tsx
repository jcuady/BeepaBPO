import Link from "next/link";
import {
  IconCalendar,
  IconCalendarCheck,
  IconCalendarEvent,
  IconCash,
  IconClock,
  IconFileText,
  IconTicket,
} from "@tabler/icons-react";
import { format, startOfWeek, addDays } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { ClockInOutCard } from "@/components/app/clock-in-out-card";
import { WeeklyAttendanceChartLazy as WeeklyAttendanceChart } from "@/components/app/charts-lazy";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatWorkedMinutes } from "@/lib/attendance/minutes";
import { PageContainer } from "@/components/app/page-container";

export default async function EmployeeDashboardPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login?next=/app/my");

  const supabase = await createClient();
  const name = workspace.profile.first_name || workspace.profile.display_name;

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", workspace.user.id)
    .maybeSingle();

  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const year = new Date().getFullYear();

  const [todayResult, weekResult, pendingResult, leaveResult, shiftResult, payrollResult] =
    employee
      ? await Promise.all([
          supabase
            .from("attendance_records")
            .select("clock_in_at, clock_out_at, worked_minutes, status")
            .eq("employee_id", employee.id)
            .eq("work_date", today)
            .maybeSingle(),
          supabase
            .from("attendance_records")
            .select("work_date, worked_minutes, status")
            .eq("employee_id", employee.id)
            .gte("work_date", format(weekStart, "yyyy-MM-dd"))
            .lte("work_date", format(addDays(weekStart, 6), "yyyy-MM-dd")),
          supabase
            .from("approval_requests")
            .select("*", { count: "exact", head: true })
            .eq("requester_user_id", workspace.user.id)
            .eq("status", "pending"),
          supabase
            .from("leave_balances")
            .select(
              "id, entitled_minutes, used_minutes, pending_minutes, leave_types(name)",
            )
            .eq("employee_id", employee.id)
            .eq("period_year", year),
          supabase
            .from("shift_assignments")
            .select("id, work_date, scheduled_start, scheduled_end, status")
            .eq("employee_id", employee.id)
            .gte("work_date", today)
            .order("work_date")
            .limit(3),
          supabase
            .from("payroll_periods")
            .select("name, pay_date")
            .gte("pay_date", today)
            .order("pay_date")
            .limit(1)
            .maybeSingle(),
        ])
      : await Promise.all([
          Promise.resolve({ data: null }),
          Promise.resolve({ data: [] as { work_date: string; worked_minutes: number; status: string }[] }),
          supabase
            .from("approval_requests")
            .select("*", { count: "exact", head: true })
            .eq("requester_user_id", workspace.user.id)
            .eq("status", "pending"),
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: null }),
        ]);

  const todayRecord = todayResult.data as {
    clock_in_at: string | null;
    clock_out_at: string | null;
    worked_minutes: number;
    status: string;
  } | null;
  const weekRecords =
    (weekResult.data as { work_date: string; worked_minutes: number; status: string }[] | null) ??
    [];
  const pendingApprovals = pendingResult.count;
  const balances = (leaveResult.data ?? []) as {
    entitled_minutes: number;
    used_minutes: number;
    pending_minutes: number;
    leave_types: { name: string } | null;
  }[];
  const upcomingShifts = (shiftResult.data ?? []) as {
    id: string;
    work_date: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
  }[];
  const nextPayroll = payrollResult.data as { name: string; pay_date: string } | null;

  const todayShift = upcomingShifts.find((s) => s.work_date === today);

  const chartData = weekDays.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const rec = weekRecords.find((r) => r.work_date === key);
    return {
      day: format(day, "EEE"),
      hours: rec ? Math.round((rec.worked_minutes / 60) * 10) / 10 : 0,
      status: rec?.status ?? "upcoming",
    };
  });

  const daysPresent = weekRecords.filter((r) =>
    ["present", "late", "wfh"].includes(r.status),
  ).length;

  const isClockedIn = Boolean(
    todayRecord?.clock_in_at && !todayRecord?.clock_out_at,
  );

  const attendanceStatus = todayRecord?.status ?? "absent";
  const statusLabel = todayRecord?.clock_in_at
    ? isClockedIn
      ? "Clocked in"
      : "Completed"
    : "Not yet clocked in";

  const quickActions = [
    {
      label: "Request Leave",
      href: "/app/my/leave",
      icon: IconCalendarEvent,
    },
    {
      label: "Cash Advance",
      href: "/app/my/cash-advances",
      icon: IconCash,
    },
    {
      label: "Attendance Correction",
      href: "/app/my/attendance",
      icon: IconClock,
    },
    {
      label: "Submit a Ticket",
      href: "/app/my/requests",
      icon: IconTicket,
    },
  ];

  return (
    <PageContainer size="wide">
      <PageHeader
        name={name}
        subtitle="Here's your time, tasks, and updates for today."
        quote="Small steps every day create big progress."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Today's Shift"
          value={
            todayShift?.scheduled_start
              ? format(new Date(todayShift.scheduled_start), "h:mm a")
              : "—"
          }
          subtitle={
            todayShift?.scheduled_end
              ? `Until ${format(new Date(todayShift.scheduled_end), "h:mm a")}`
              : "Schedule not assigned yet"
          }
          icon={IconCalendar}
        />
        <MetricCard
          title="Attendance Status"
          value={statusLabel}
          subtitle={
            todayRecord ? (
              <StatusBadge status={attendanceStatus} />
            ) : (
              "See you at work!"
            )
          }
          icon={IconClock}
        />
        <MetricCard
          title="Working Hours Today"
          value={formatWorkedMinutes(todayRecord?.worked_minutes ?? 0)}
          subtitle="Target: 9h 0m"
          icon={IconClock}
        />
        <MetricCard
          title="Days This Week"
          value={`${daysPresent} / 5`}
          subtitle={
            daysPresent >= 5 ? "Full week!" : `${5 - daysPresent} more to go`
          }
          icon={IconCalendarCheck}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ClockInOutCard isClockedIn={isClockedIn} />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Weekly Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyAttendanceChart data={chartData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Leave Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <EmptyState
                title="No leave balances yet"
                description="Leave types and balances will appear once HR configures your profile."
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <ul className="space-y-3">
                {balances.slice(0, 4).map((row, index) => {
                  const remaining =
                    row.entitled_minutes -
                    row.used_minutes -
                    row.pending_minutes;
                  const days = Math.round((remaining / 480) * 10) / 10;
                  return (
                    <li
                      key={`${row.leave_types?.name ?? "leave"}-${index}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate">
                        {row.leave_types?.name ?? "Leave"}
                      </span>
                      <span className="font-medium text-navy">
                        {days} day{days === 1 ? "" : "s"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.label}
                    variant="secondary"
                    className="h-auto min-h-11 flex-col gap-2 py-4"
                    nativeButton={false}
                    render={<Link href={action.href} />}
                  >
                    <Icon stroke={1.75} className="size-6 text-green" />
                    <span className="text-center text-xs font-medium text-navy">
                      {action.label}
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Next Payroll
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate">
              {nextPayroll?.name ?? "Semi-monthly payroll"}
            </p>
            <p className="font-display text-lg font-bold text-navy">
              {nextPayroll?.pay_date
                ? format(new Date(nextPayroll.pay_date), "MMM d, yyyy")
                : "—"}
            </p>
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              nativeButton={false}
              render={<Link href="/app/my/payroll" />}
            >
              View Details
            </Button>
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-display text-base text-navy">
              Upcoming schedule
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/app/my/schedule" />}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingShifts.length === 0 ? (
              <EmptyState
                title="No upcoming shifts"
                description="Your schedule will show here once assigned."
                className="border-0 bg-transparent py-4"
              />
            ) : (
              <ul className="space-y-3">
                {upcomingShifts.map((shift) => (
                  <li
                    key={shift.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-navy">
                      {format(new Date(`${shift.work_date}T00:00:00`), "EEE, MMM d")}
                    </span>
                    <span className="text-slate">
                      {shift.scheduled_start
                        ? format(new Date(shift.scheduled_start), "h:mm a")
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate">
              Company announcements are delivered as notifications for now.
            </p>
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              nativeButton={false}
              render={<Link href="/app/my/notifications" />}
            >
              Open notifications
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base text-navy">
            My Tasks & Approvals
          </CardTitle>
          <span className="text-sm text-slate">
            {pendingApprovals ?? 0} pending
          </span>
        </CardHeader>
        <CardContent>
          {(pendingApprovals ?? 0) === 0 ? (
            <EmptyState
              title="All caught up"
              description="Pending tasks and approvals will show here."
              icon={IconFileText}
              className="border-0 bg-transparent py-4"
            />
          ) : (
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/app/my/requests" />}
            >
              View pending requests
            </Button>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
