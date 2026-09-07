import type { Metadata } from "next";
import { format } from "date-fns";
import { IconCalendarEvent } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { CancelLeaveButton } from "@/components/app/leave/cancel-leave-button";
import { LeaveRequestForm } from "@/components/app/leave/leave-request-form";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Leave" };

function formatMinutes(mins: number) {
  const days = Math.round((mins / 480) * 10) / 10;
  return `${days} day${days === 1 ? "" : "s"}`;
}

export default async function MyLeavePage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const employee = await resolveEmployeeForUser(workspace.user.id);
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const { data: leaveTypes } = await supabase
    .from("leave_types")
    .select("id, name")
    .eq("active", true)
    .order("name");

  let balances: {
    id: string;
    entitled_minutes: number;
    used_minutes: number;
    pending_minutes: number;
    leave_types: { name: string } | null;
  }[] = [];
  let requests: {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    reason: string;
    leave_types: { name: string } | null;
  }[] = [];

  if (employee) {
    const [{ data: balanceRows }, { data: requestRows }] = await Promise.all([
      supabase
        .from("leave_balances")
        .select(
          "id, entitled_minutes, used_minutes, pending_minutes, leave_types(name)",
        )
        .eq("employee_id", employee.id)
        .eq("period_year", year),
      supabase
        .from("leave_requests")
        .select("id, start_at, end_at, status, reason, leave_types(name)")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    balances = (balanceRows ?? []) as typeof balances;
    requests = (requestRows ?? []) as typeof requests;
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Request time off and track leave balances."
      />

      {!employee ? (
        <EmptyState
          icon={IconCalendarEvent}
          title="Employee profile not linked"
          description="Your account is not linked to an employee record yet. Contact HR to get set up."
        />
      ) : (
        <>
          <Card className="">
            <CardHeader>
              <CardTitle className="font-display text-base text-navy">
                Leave balances ({year})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balances.length === 0 ? (
                <p className="text-sm text-slate">
                  No leave balances configured for this year yet.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {balances.map((balance) => (
                    <div
                      key={balance.id}
                      className="rounded-[12px] border border-line px-4 py-3"
                    >
                      <p className="font-medium text-navy">
                        {balance.leave_types?.name ?? "Leave"}
                      </p>
                      <p className="mt-1 text-sm text-slate">
                        {formatMinutes(
                          balance.entitled_minutes -
                            balance.used_minutes -
                            balance.pending_minutes,
                        )}{" "}
                        available · {formatMinutes(balance.pending_minutes)}{" "}
                        pending
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="">
            <CardHeader>
              <CardTitle className="font-display text-base text-navy">
                New leave request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeaveRequestForm leaveTypes={leaveTypes ?? []} />
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h2 className="font-display text-base font-semibold text-navy">
              Your requests
            </h2>
            {requests.length === 0 ? (
              <EmptyState
                icon={IconCalendarEvent}
                title="No leave requests yet"
                description="Submit a leave request when you need time away from work."
              />
            ) : (
              requests.map((req) => (
                <Card
                  key={req.id}
                  className=""
                >
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium text-navy">
                        {req.leave_types?.name ?? "Leave"} ·{" "}
                        {format(new Date(req.start_at), "MMM d")} –{" "}
                        {format(new Date(req.end_at), "MMM d, yyyy")}
                      </p>
                      {req.reason ? (
                        <p className="text-sm text-slate">{req.reason}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={req.status} />
                      {req.status === "pending" ? (
                        <CancelLeaveButton requestId={req.id} />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
