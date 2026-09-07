import type { Metadata } from "next";
import { format } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { AttendanceCorrectionForm } from "@/components/app/attendance/correction-request-form";
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

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Review your attendance history and corrections."
      />

      <Card className="">
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

      {records.length === 0 ? (
        <EmptyState
          icon={IconClock}
          title="No attendance records yet"
          description="Your daily attendance will appear here after you clock in."
        />
      ) : (
        <div className="space-y-2">
          {records.map((row) => (
            <Card
              key={row.id}
              className=""
            >
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
