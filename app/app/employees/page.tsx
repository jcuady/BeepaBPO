import type { Metadata } from "next";
import Link from "next/link";
import { IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
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
import { stringParam, ilikePattern, pageParam } from "@/lib/app/search-params";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Employees" };

const PAGE_SIZE = 50;

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
  const page = pageParam(params.page);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();

  let query = supabase
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
    query = profileIds.length
      ? query.or(
          `employee_number.ilike.${pattern},job_title.ilike.${pattern},profile_id.in.(${profileIds.join(",")})`,
        )
      : query.or(
          `employee_number.ilike.${pattern},job_title.ilike.${pattern}`,
        );
  }

  const { data } = await query;
  const employees = (data ?? []) as {
    id: string;
    employee_number: string;
    job_title: string | null;
    employment_status: string;
    profiles: {
      display_name: string;
      first_name: string;
      last_name: string;
    } | null;
  }[];

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

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={employees.length}
        query={{ q }}
      />

      <Link
        href="/app/hr"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to HR
      </Link>
    </PageContainer>
  );
}
