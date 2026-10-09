import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { SalarySettingsForm } from "@/components/app/payroll/salary-settings-form";
import type { SalaryFrequency } from "@/lib/payroll/schedule";
import { resolveWorkspace, requireInternal, requirePermission } from "@/lib/auth/workspace";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payroll settings" };

const FREQUENCIES = new Set<SalaryFrequency>([
  "semi_monthly",
  "monthly",
  "weekly",
]);

export default async function PayrollSettingsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "payroll.manage");

  const supabase = await createClient();
  const [{ data: employees }, { data: profiles }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_number, job_title, profile_id")
      .eq("organization_id", BEEPA_ORG_ID)
      .eq("employment_status", "active")
      .order("employee_number", { ascending: true })
      .limit(200),
    supabase
      .from("payroll_profiles")
      .select("employee_id, base_salary, pay_frequency")
      .limit(500),
  ]);

  const profileIds = (employees ?? [])
    .map((employee) => employee.profile_id)
    .filter((id): id is string => Boolean(id));

  const { data: names } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", profileIds)
    : { data: [] };

  const nameById = new Map(
    (names ?? []).map((profile) => [
      profile.id,
      [profile.first_name, profile.last_name].filter(Boolean).join(" "),
    ]),
  );
  const payByEmployee = new Map(
    (profiles ?? []).map((profile) => [profile.employee_id, profile]),
  );

  const rows = (employees ?? []).map((employee) => {
    const pay = payByEmployee.get(employee.id);
    const frequency = FREQUENCIES.has(pay?.pay_frequency as SalaryFrequency)
      ? (pay?.pay_frequency as SalaryFrequency)
      : "semi_monthly";
    return {
      employeeId: employee.id,
      name:
        (employee.profile_id && nameById.get(employee.profile_id)) ||
        employee.employee_number,
      employeeNumber: employee.employee_number,
      jobTitle: employee.job_title,
      baseSalary: Number(pay?.base_salary ?? 0),
      payFrequency: frequency,
    };
  });

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Set each monthly salary and pay frequency. Runs pay that fixed amount. Tax and statutory benefits are not deducted."
      />
      <SalarySettingsForm rows={rows} />
    </PageContainer>
  );
}
