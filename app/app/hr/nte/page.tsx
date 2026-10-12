import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { IconFileText } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { NteCaseForm } from "@/components/app/nte/nte-case-form";
import { NteResolveForm } from "@/components/app/nte/nte-resolve-form";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { enumParam, ilikePattern, pageParam, stringParam } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "NTE Cases" };

const OPEN_STATUSES = new Set(["issued", "awaiting_response", "under_review"]);
const ALL_STATUSES = [
  "draft",
  "issued",
  "awaiting_response",
  "under_review",
  "resolved",
] as const;
const PAGE_SIZE = 50;

export default async function HrNtePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "nte.read");

  const params = await searchParams;
  const status = enumParam(params.status, ALL_STATUSES);
  const q = stringParam(params.q);
  const page = pageParam(params.page);

  const supabase = await createClient();
  const canManage = can(workspace.permissions, "nte.manage");
  const pattern = q ? ilikePattern(q) : undefined;

  // The search box was rendered, submitted and carried through the pager, but `q`
  // never reached the query -- so typing a case number returned the whole
  // unfiltered list with no indication the search had been ignored. Same shape as
  // /app/tickets.
  let caseQuery = supabase
    .from("nte_cases")
    .select(
      "id, case_number, subject, description, incident_date, status, resolution_type, resolution_notes, resolved_at, created_at, employees(employee_number, profiles(display_name)), nte_responses(id, response_text, submitted_at)",
    )
    .order("created_at", { ascending: false });
  if (pattern) {
    caseQuery = caseQuery.or(`subject.ilike.${pattern},case_number.ilike.${pattern}`);
  }
  if (status) {
    caseQuery = caseQuery.eq("status", status);
  }

  const [{ data: caseRows }, { data: employees }] = await Promise.all([
    caseQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    canManage
      ? supabase
          .from("employees")
          .select("id, employee_number, profiles(display_name)")
          .eq("employment_status", "active")
          .order("employee_number")
          .limit(200)
      : Promise.resolve({
          data: [] as {
            id: string;
            employee_number: string;
            profiles: { display_name: string } | null;
          }[],
        }),
  ]);

  // One extra row proves a next page exists; drop it so rowCount is the rendered count.
  const cases = caseRows?.slice(0, PAGE_SIZE);

  const employeeOptions = (employees ?? []).map((emp) => {
    const profile = emp.profiles as { display_name: string } | null;
    return {
      id: emp.id,
      label: `${profile?.display_name ?? emp.employee_number} (${emp.employee_number})`,
    };
  });

  return (
    <PageContainer>
      <PageHeader
        title="NTE Cases"
        name={workspace.profile.first_name}
        subtitle="Notice to Explain cases."
      />

      {canManage && employeeOptions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Create NTE case
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NteCaseForm employees={employeeOptions} />
          </CardContent>
        </Card>
      ) : null}

      <form method="get">
        <FilterBar placeholder="Search subject or case number…" defaultValue={q}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...ALL_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
            ]}
          />
        </FilterBar>
      </form>

      {!cases?.length ? (
        <EmptyState
          icon={IconFileText}
          title="No NTE cases"
          description="Issued cases will appear here."
        />
      ) : (
        <div className="space-y-4">
          {cases.map((row) => {
            const emp = row.employees as {
              employee_number: string;
              profiles: { display_name: string } | null;
            } | null;
            const responses = (row.nte_responses ?? []) as {
              id: string;
              response_text: string;
              submitted_at: string;
            }[];
            const canResolve =
              canManage && OPEN_STATUSES.has(row.status);

            return (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="font-display text-base text-navy">
                      {row.case_number} · {row.subject}
                    </CardTitle>
                    <StatusBadge status={row.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate">
                    {emp?.profiles?.display_name ??
                      emp?.employee_number ??
                      "—"}{" "}
                    · Incident{" "}
                    {format(new Date(row.incident_date), "MMM d, yyyy")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate">
                    {row.description}
                  </p>
                  {responses.map((resp) => (
                    <div
                      key={resp.id}
                      className="rounded-none border border-line bg-mist/50 p-3 text-sm"
                    >
                      <p className="text-xs text-slate">
                        Employee response ·{" "}
                        {format(new Date(resp.submitted_at), "MMM d, yyyy")}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-navy">
                        {resp.response_text}
                      </p>
                    </div>
                  ))}
                  {row.status === "resolved" ? (
                    <div className="rounded-none border border-line bg-soft-green/40 p-3 text-sm">
                      <p className="font-medium text-navy">
                        Resolved
                        {row.resolution_type
                          ? ` · ${row.resolution_type.replace(/_/g, " ")}`
                          : ""}
                      </p>
                      {row.resolved_at ? (
                        <p className="text-xs text-slate">
                          {format(
                            new Date(row.resolved_at),
                            "MMM d, yyyy h:mm a",
                          )}
                        </p>
                      ) : null}
                      {row.resolution_notes ? (
                        <p className="mt-1 whitespace-pre-wrap text-slate">
                          {row.resolution_notes}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {canResolve ? (
                    <NteResolveForm
                      nteCaseId={row.id}
                      caseNumber={row.case_number}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Link
        href="/app/hr"
        className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to HR
      </Link>

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={cases?.length ?? 0}
        query={{ q, status }}
      />
    </PageContainer>
  );
}
