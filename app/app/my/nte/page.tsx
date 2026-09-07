import type { Metadata } from "next";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { IconFileText } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { NteResponseForm } from "@/components/app/nte/nte-response-form";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { resolveEmployeeForUser } from "@/lib/employees/resolve";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My NTE" };

export default async function MyNtePage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const employee = await resolveEmployeeForUser(workspace.user.id);
  if (!employee) {
    return (
      <PageContainer size="narrow">
        <PageHeader
          name={workspace.profile.first_name}
          subtitle="Notice to Explain"
        />
        <EmptyState
          icon={IconFileText}
          title="No employee record"
          description="Your account is not linked to an employee profile yet."
        />
      </PageContainer>
    );
  }

  const supabase = await createClient();
  const { data: cases } = await supabase
    .from("nte_cases")
    .select(
      "id, case_number, subject, description, incident_date, status, response_due_at, resolution_type, resolution_notes, resolved_at, nte_responses(id, response_text, submitted_at)",
    )
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Your Notice to Explain cases."
      />

      {!cases?.length ? (
        <EmptyState
          icon={IconFileText}
          title="No NTE cases"
          description="You have no open or past NTE cases."
        />
      ) : (
        <div className="space-y-4">
          {cases.map((row) => {
            const responses = (row.nte_responses ?? []) as {
              id: string;
              response_text: string;
              submitted_at: string;
            }[];
            const needsResponse =
              ["issued", "awaiting_response"].includes(row.status) &&
              responses.length === 0;

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
                  <p className="whitespace-pre-wrap text-sm text-slate">
                    {row.description}
                  </p>
                  <p className="text-xs text-slate">
                    Incident{" "}
                    {format(new Date(row.incident_date), "MMM d, yyyy")}
                    {row.response_due_at
                      ? ` · Due ${format(new Date(row.response_due_at), "MMM d, yyyy")}`
                      : ""}
                  </p>
                  {responses.map((resp) => (
                    <div
                      key={resp.id}
                      className="rounded-[12px] border border-line bg-mist/50 p-3 text-sm"
                    >
                      <p className="text-xs text-slate">
                        Submitted{" "}
                        {format(new Date(resp.submitted_at), "MMM d, yyyy")}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-navy">
                        {resp.response_text}
                      </p>
                    </div>
                  ))}
                  {row.status === "resolved" ? (
                    <div className="rounded-[12px] border border-line bg-soft-green/40 p-3 text-sm">
                      <p className="font-medium text-navy">
                        Outcome
                        {row.resolution_type
                          ? ` · ${row.resolution_type.replace(/_/g, " ")}`
                          : ""}
                      </p>
                      {row.resolved_at ? (
                        <p className="text-xs text-slate">
                          {format(
                            new Date(row.resolved_at),
                            "MMM d, yyyy",
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
                  {needsResponse ? <NteResponseForm nteCaseId={row.id} /> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
