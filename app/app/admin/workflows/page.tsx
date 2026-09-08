import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { IconGitBranch } from "@tabler/icons-react";

export const metadata: Metadata = { title: "Approval Workflows" };

export default async function AdminWorkflowsPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requirePermission(workspace, "system.manage");

  const supabase = await createClient();
  const { data: workflows } = await supabase
    .from("approval_workflows")
    .select(
      "id, code, name, entity_type, active, approval_steps(id, step_order, role_code, permission_code, name)",
    )
    .eq("organization_id", BEEPA_ORG_ID)
    .order("code");

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="View-only map of active approval workflows and steps (DB-driven)."
      />

      {!workflows?.length ? (
        <EmptyState
          icon={IconGitBranch}
          title="No workflows"
          description="Seed approval_workflows for this organization to enable queues."
        />
      ) : (
        <div className="space-y-4">
          {workflows.map((wf) => {
            const steps = (
              Array.isArray(wf.approval_steps) ? wf.approval_steps : []
            ).slice().sort((a, b) => a.step_order - b.step_order);
            return (
              <Card key={wf.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="font-display text-base text-navy">
                      {wf.name}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{wf.code}</Badge>
                      <Badge variant="outline">{wf.entity_type}</Badge>
                      <Badge variant="outline">
                        {wf.active ? "active" : "inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {!steps.length ? (
                    <p className="text-slate">No steps configured.</p>
                  ) : (
                    steps.map((step) => (
                      <div
                        key={step.id}
                        className="flex flex-wrap items-center gap-2 border-b border-line pb-2 last:border-0"
                      >
                        <span className="font-medium text-navy">
                          {step.step_order}. {step.name}
                        </span>
                        {step.role_code ? (
                          <span className="text-slate">
                            role:{step.role_code}
                          </span>
                        ) : null}
                        {step.permission_code ? (
                          <span className="text-slate">
                            perm:{step.permission_code}
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
