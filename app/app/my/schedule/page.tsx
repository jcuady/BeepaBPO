import type { Metadata } from "next";
import { format, addDays } from "date-fns";
import { IconCalendar } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Schedule" };

export default async function MySchedulePage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const employee = await resolveEmployeeForUser(workspace.user.id);
  const supabase = await createClient();
  const from = format(new Date(), "yyyy-MM-dd");
  const to = format(addDays(new Date(), 13), "yyyy-MM-dd");

  let shifts: {
    id: string;
    work_date: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    status: string;
  }[] = [];

  if (employee) {
    const { data } = await supabase
      .from("shift_assignments")
      .select("id, work_date, scheduled_start, scheduled_end, status")
      .eq("employee_id", employee.id)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date");
    shifts = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="View your assigned shifts and calendar."
      />
      {!employee || shifts.length === 0 ? (
        <EmptyState
          icon={IconCalendar}
          title="No schedule assigned"
          description="Your shift schedule will appear here once HR publishes it."
        />
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => (
            <Card
              key={shift.id}
              className=""
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">
                    {format(new Date(`${shift.work_date}T00:00:00`), "EEEE, MMM d")}
                  </p>
                  <p className="text-sm text-slate">
                    {shift.scheduled_start
                      ? format(new Date(shift.scheduled_start), "h:mm a")
                      : "—"}{" "}
                    –{" "}
                    {shift.scheduled_end
                      ? format(new Date(shift.scheduled_end), "h:mm a")
                      : "—"}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {shift.status.replace(/_/g, " ")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
