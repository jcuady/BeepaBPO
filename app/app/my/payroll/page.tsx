import type { Metadata } from "next";
import { format } from "date-fns";
import { IconCoin } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { PayslipDownloadButton } from "@/components/app/payroll/payslip-download-button";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Payroll" };

export default async function MyPayrollPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const employee = await resolveEmployeeForUser(workspace.user.id);
  const supabase = await createClient();

  let records: {
    id: string;
    net_pay: number;
    gross_pay: number;
    status: string;
    payroll_periods: { name: string; pay_date: string } | null;
  }[] = [];

  if (employee) {
    const { data } = await supabase
      .from("payroll_records")
      .select("id, net_pay, gross_pay, status, payroll_periods(name, pay_date)")
      .eq("employee_id", employee.id)
      .in("status", ["finalized", "paid", "approved"])
      .order("created_at", { ascending: false })
      .limit(12);

    records = (data ?? []) as typeof records;
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Finalized payroll summaries with PDF payslip download."
      />

      {!employee ? (
        <EmptyState
          icon={IconCoin}
          title="Employee profile not linked"
          description="Payslips will appear here once your employee record is set up."
        />
      ) : records.length === 0 ? (
        <EmptyState
          icon={IconCoin}
          title="No payroll records yet"
          description="Summaries and PDF payslips appear here after payroll is finalized."
        />
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <Card key={record.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">
                    {record.payroll_periods?.name ?? "Payroll period"}
                  </p>
                  <p className="text-sm text-slate">
                    Pay date:{" "}
                    {record.payroll_periods?.pay_date
                      ? format(
                          new Date(record.payroll_periods.pay_date),
                          "MMM d, yyyy",
                        )
                      : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right">
                    <p className="font-display text-lg font-bold text-navy">
                      ₱{Number(record.net_pay).toLocaleString()}
                    </p>
                    <Badge variant="outline" className="capitalize">
                      {record.status}
                    </Badge>
                  </div>
                  <PayslipDownloadButton payrollRecordId={record.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
