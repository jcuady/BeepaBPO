import type { Metadata } from "next";
import Link from "next/link";
import { IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
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
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { stringParam, ilikePattern } from "@/lib/app/search-params";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "employees.read");

  const params = await searchParams;
  const q = stringParam(params.q);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();

  let employees: {
    id: string;
    employee_number: string;
    job_title: string | null;
    employment_status: string;
    profiles: {
      display_name: string;
      first_name: string;
      last_name: string;
    } | null;
  }[] = [];

  if (pattern) {
    const [{ data: byEmp }, { data: profileMatches }] = await Promise.all([
      supabase
        .from("employees")
        .select(
          "id, employee_number, job_title, employment_status, profiles(display_name, first_name, last_name)",
        )
        .eq("employment_status", "active")
        .or(`employee_number.ilike.${pattern},job_title.ilike.${pattern}`)
        .order("employee_number")
        .limit(100),
      supabase
        .from("profiles")
        .select("id")
        .or(
          `display_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`,
        )
        .limit(100),
    ]);

    const profileIds = (profileMatches ?? []).map((p) => p.id);
    let byProfile: typeof employees = [];
    if (profileIds.length) {
      const { data } = await supabase
        .from("employees")
        .select(
          "id, employee_number, job_title, employment_status, profiles(display_name, first_name, last_name)",
        )
        .eq("employment_status", "active")
        .in("profile_id", profileIds)
        .order("employee_number")
        .limit(100);
      byProfile = (data ?? []) as typeof employees;
    }

    const map = new Map<string, (typeof employees)[number]>();
    for (const row of [...(byEmp ?? []), ...byProfile] as typeof employees) {
      map.set(row.id, row);
    }
    employees = [...map.values()].slice(0, 100);
  } else {
    const { data } = await supabase
      .from("employees")
      .select(
        "id, employee_number, job_title, employment_status, profiles(display_name, first_name, last_name)",
      )
      .eq("employment_status", "active")
      .order("employee_number")
      .limit(100);
    employees = (data ?? []) as typeof employees;
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Search and browse employee records. New hires come from Recruitment → Convert."
      />

      <form method="get">
        <FilterBar
          placeholder="Search by name, number, or title…"
          defaultValue={q}
        />
      </form>

      {employees.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          title="No employees found"
          description={
            q
              ? "Try a different search term."
              : "Active employees will appear here."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => {
                const profile = emp.profiles;
                const name =
                  profile?.display_name ||
                  [profile?.first_name, profile?.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                  emp.employee_number;
                return (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <Link
                        href={`/app/employees/${emp.id}`}
                        className="font-medium text-navy hover:text-green-strong"
                      >
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate">
                      {emp.employee_number}
                    </TableCell>
                    <TableCell className="text-slate">
                      {emp.job_title || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={emp.employment_status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Link
        href="/app/hr"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to HR
      </Link>
    </PageContainer>
  );
}
