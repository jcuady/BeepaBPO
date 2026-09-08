import type { Metadata } from "next";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { DocumentDownloadButton } from "@/components/app/documents/document-download-button";
import { DocumentUploadForm } from "@/components/app/documents/document-upload-form";
import { EmployeeEditForm } from "@/components/app/employees/employee-edit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { formatWorkedMinutes } from "@/lib/attendance/minutes";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "employees.read");

  const supabase = await createClient();
  const since = format(subDays(new Date(), 14), "yyyy-MM-dd");

  const [
    { data: employee },
    { data: assignments },
    { data: balances },
    { data: attendance },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, employee_number, job_title, employment_status, employment_type, hire_date, work_email, personal_email, default_timezone, department_id, profiles(display_name, first_name, last_name, phone, timezone)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("employee_assignments")
      .select(
        "id, role_title, status, start_date, end_date, assignment_type, client_org:organizations!client_organization_id(name)",
      )
      .eq("employee_id", id)
      .order("start_date", { ascending: false })
      .limit(20),
    supabase
      .from("leave_balances")
      .select(
        "entitled_minutes, used_minutes, pending_minutes, adjustment_minutes, leave_types(name, code)",
      )
      .eq("employee_id", id)
      .limit(20),
    supabase
      .from("attendance_records")
      .select(
        "id, work_date, clock_in_at, clock_out_at, worked_minutes, status",
      )
      .eq("employee_id", id)
      .gte("work_date", since)
      .order("work_date", { ascending: false })
      .limit(14),
    supabase
      .from("documents")
      .select("id, title, category, created_at, visibility")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!employee) notFound();

  const profile = employee.profiles as {
    display_name: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    timezone: string;
  } | null;
  const name =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    employee.employee_number;
  const canManageDocs = can(
    workspace.permissions,
    "employees.documents.manage",
  );
  const canManageEmployee = can(workspace.permissions, "employees.manage");

  return (
    <PageContainer>
      <PageHeader name={workspace.profile.first_name} subtitle={name} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-display text-base text-navy">
              {name}
            </CardTitle>
            <Badge variant="outline" className="capitalize">
              {employee.employment_status.replace(/_/g, " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate">Employee #</span>{" "}
            <span className="font-medium text-navy">
              {employee.employee_number}
            </span>
          </p>
          <p>
            <span className="text-slate">Title</span>{" "}
            <span className="font-medium text-navy">
              {employee.job_title || "—"}
            </span>
          </p>
          <p>
            <span className="text-slate">Work email</span>{" "}
            <span className="font-medium text-navy">
              {employee.work_email || "—"}
            </span>
          </p>
          <p>
            <span className="text-slate">Hire date</span>{" "}
            <span className="font-medium text-navy">
              {employee.hire_date
                ? format(new Date(employee.hire_date), "MMM d, yyyy")
                : "—"}
            </span>
          </p>
        </CardContent>
      </Card>

      {canManageEmployee ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Edit employee record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeEditForm
              defaultValues={{
                employee_id: employee.id,
                job_title: employee.job_title ?? "",
                employment_status: employee.employment_status,
                employment_type: employee.employment_type,
                hire_date: employee.hire_date ?? "",
                work_email: employee.work_email ?? "",
                personal_email: employee.personal_email ?? "",
                default_timezone:
                  employee.default_timezone ||
                  profile?.timezone ||
                  "Asia/Manila",
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold text-navy">
          Assignments
        </h2>
        {(assignments ?? []).length === 0 ? (
          <p className="text-sm text-slate">No assignments.</p>
        ) : (
          (assignments ?? []).map((row) => {
            const org = row.client_org as { name: string } | null;
            return (
              <Card key={row.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium text-navy">
                      {row.role_title || row.assignment_type}
                    </p>
                    <p className="text-sm text-slate">
                      {org?.name ?? "Internal"} · {row.start_date ?? "—"}
                      {row.end_date ? ` – ${row.end_date}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {row.status}
                  </Badge>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold text-navy">
          Leave balances
        </h2>
        {(balances ?? []).length === 0 ? (
          <p className="text-sm text-slate">No leave balances.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(balances ?? []).map((row, i) => {
              const lt = row.leave_types as { name: string; code: string } | null;
              const remaining =
                (row.entitled_minutes ?? 0) +
                (row.adjustment_minutes ?? 0) -
                (row.used_minutes ?? 0) -
                (row.pending_minutes ?? 0);
              return (
                <Card key={`${lt?.code ?? i}`}>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate">{lt?.name ?? "Leave"}</p>
                    <p className="font-display text-lg font-semibold text-navy">
                      {formatWorkedMinutes(Math.max(0, remaining))}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold text-navy">
          Documents
        </h2>
        {canManageDocs ? (
          <DocumentUploadForm mode="employee" employeeId={id} />
        ) : null}
        {(documents ?? []).length === 0 ? (
          <p className="text-sm text-slate">No documents on file.</p>
        ) : (
          (documents ?? []).map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium text-navy">{doc.title}</p>
                  <p className="text-sm text-slate">
                    {doc.category} ·{" "}
                    {format(new Date(doc.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {doc.visibility.replace(/_/g, " ")}
                  </Badge>
                  <DocumentDownloadButton documentId={doc.id} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold text-navy">
          Last 14 days attendance
        </h2>
        {(attendance ?? []).length === 0 ? (
          <p className="text-sm text-slate">No attendance records.</p>
        ) : (
          (attendance ?? []).map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium text-navy">
                    {format(new Date(row.work_date), "EEE, MMM d")}
                  </p>
                  <p className="text-sm text-slate">
                    {row.worked_minutes != null
                      ? formatWorkedMinutes(row.worked_minutes)
                      : "—"}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <Link
        href="/app/employees"
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to employees
      </Link>
    </PageContainer>
  );
}
