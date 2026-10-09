import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { can, canAny } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { buildSimplePdf, formatMoney } from "@/lib/payroll/payslip-pdf";
import {
  isRecordPayable,
  isRecordStatusPayable,
} from "@/lib/payroll/status-coherence";

/**
 * A payslip is only payable once the *period* has been approved, not merely once
 * the record carries a final-looking status.
 *
 * `payroll_records.status` and `payroll_periods.status` move independently, and
 * nothing in application code kept them consistent. Live data proved the gap: a
 * period still in `draft` held ten finalized records totalling 500,000 in net
 * pay, and an employee could download the PDF.
 *
 * Requiring both is strictly narrowing — the normal approval flow finalises the
 * period and its records together — so this cannot withhold a legitimately
 * approved payslip.
 *
 * The rule itself lives in `@/lib/payroll/status-coherence` so this route, the
 * payroll list, the seed script, and the database trigger cannot drift apart.
 */

export async function GET(
  _request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await context.params;
  const workspace = await resolveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: record } = await supabase
    .from("payroll_records")
    .select(
      "id, employee_id, status, basic_pay, allowances, overtime_pay, bonuses, incentives, commissions, gross_pay, total_deductions, cash_advance_deduction, undertime_deduction, absence_deduction, unpaid_leave_deduction, other_deductions, net_pay, worked_minutes, payroll_periods(name, pay_date, start_date, end_date, status), employees(employee_number, job_title, work_email, profiles(display_name))",
    )
    .eq("id", recordId)
    .maybeSingle();

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const periodStatus = (record.payroll_periods as { status?: string } | null)?.status;

  if (!isRecordPayable(record.status, periodStatus)) {
    // Separate the two reasons so the employee is told which one is blocking
    // them: "not finalized yet" is normal, "this run isn't approved" is not.
    if (!isRecordStatusPayable(record.status)) {
      return NextResponse.json(
        { error: "Payslip available after payroll is approved or finalized." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error: `This payroll run is still ${periodStatus ?? "unapproved"}. Payslips are released once the period is approved.`,
      },
      { status: 403 },
    );
  }

  const self = await resolveEmployeeForUser(workspace.user.id);
  const isSelf = self?.id === record.employee_id;
  const canReadOthers = canAny(workspace.permissions, [
    "payroll.read",
    "payroll.manage",
  ]);

  if (isSelf) {
    if (!can(workspace.permissions, "payroll.self") && !canReadOthers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!canReadOthers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = record.payroll_periods as {
    name: string;
    pay_date: string;
    start_date: string;
    end_date: string;
  } | null;
  const employee = record.employees as {
    employee_number: string;
    job_title: string;
    work_email: string | null;
    profiles: { display_name: string | null } | null;
  } | null;

  const name =
    employee?.profiles?.display_name ||
    employee?.employee_number ||
    "Employee";

  const lines = [
    `Employee: ${name}`,
    `Employee no: ${employee?.employee_number ?? "—"}`,
    `Role: ${employee?.job_title ?? "—"}`,
    `Email: ${employee?.work_email ?? "—"}`,
    "",
    `Period: ${period?.name ?? "—"}`,
    `Coverage: ${period?.start_date ?? "—"} to ${period?.end_date ?? "—"}`,
    `Pay date: ${period?.pay_date ?? "—"}`,
    `Status: ${record.status}`,
    "",
    `Basic pay: ${formatMoney(record.basic_pay)}`,
    `Allowances: ${formatMoney(record.allowances)}`,
    `Overtime: ${formatMoney(record.overtime_pay)}`,
    `Bonuses: ${formatMoney(record.bonuses)}`,
    `Incentives: ${formatMoney(record.incentives)}`,
    `Commissions: ${formatMoney(record.commissions)}`,
    `Gross pay: ${formatMoney(record.gross_pay)}`,
    "",
    `Cash advance: ${formatMoney(record.cash_advance_deduction)}`,
    `Undertime: ${formatMoney(record.undertime_deduction)}`,
    `Absence: ${formatMoney(record.absence_deduction)}`,
    `Unpaid leave: ${formatMoney(record.unpaid_leave_deduction)}`,
    `Other deductions: ${formatMoney(record.other_deductions)}`,
    `Total deductions: ${formatMoney(record.total_deductions)}`,
    "",
    `Net pay: ${formatMoney(record.net_pay)}`,
    `Worked minutes: ${record.worked_minutes}`,
    "",
    "Generated by Beepa BPO. For payroll inquiries contact HR.",
  ];

  const pdf = buildSimplePdf("Beepa Payslip", lines);
  const filename = `payslip-${period?.pay_date ?? record.id}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
