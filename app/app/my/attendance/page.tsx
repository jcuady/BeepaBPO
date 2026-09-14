import type { Metadata } from "next";
import { format } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { AttendanceCorrectionForm } from "@/components/app/attendance/correction-request-form";
import { ClockInOutCard } from "@/components/app/clock-in-out-card";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconClock } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Attendance" };

export default async function MyAttendancePage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const employee = await resolveEmployeeForUser(workspace.user.id);
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");

  let records: {
    id: string;
    work_date: string;
    status: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
    worked_minutes: number;
  }[] = [];

  if (employee) {
    const { data } = await supabase
      .from("attendance_records")
      .select(
        "id, work_date, status, clock_in_at, clock_out_at, worked_minutes",
      )
      .eq("employee_id", employee.id)
      .order("work_date", { ascending: false })
      .limit(30);
    records = data ?? [];
  }

  const todayRecord = records.find((row) => row.work_date === today);
  const isClockedIn = Boolean(
    todayRecord?.clock_in_at && !todayRecord?.clock_out_at,
  );

  return (
    <PageContainer>
      {employee ? (
        <RealtimeRefresh
          tables={[
            {
              table: "attendance_records",
              filter: `employee_id=eq.${employee.id}`,
            },
          ]}
        />
      ) : null}
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Clock in or out, then review your history and corrections."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {employee ? (
          <ClockInOutCard
            isClockedIn={isClockedIn}
            locationLabel={
              isClockedIn
                ? "You are clocked in. Clock out when your shift ends."
                : "Use Clock In when your shift starts."
            }
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base text-navy">
                Clock In / Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate">
                Link your employee profile to clock in and out.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Request correction
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employee ? (
              <AttendanceCorrectionForm records={records} />
            ) : (
              <p className="text-sm text-slate">
                Link your employee profile to request attendance corrections.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={IconClock}
          title="No attendance records yet"
          description="Your daily attendance will appear here after you clock in."
        />
      ) : (
        <div className="space-y-2">
          {records.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">
                    {format(new Date(row.work_date), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-slate">
                    {row.clock_in_at
                      ? format(new Date(row.clock_in_at), "h:mm a")
                      : "—"}{" "}
                    –{" "}
                    {row.clock_out_at
                      ? format(new Date(row.clock_out_at), "h:mm a")
                      : "—"}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
