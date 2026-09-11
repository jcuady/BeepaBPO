import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconHourglass } from "@tabler/icons-react";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { TicketSlaPolicyForm } from "@/components/app/tickets/ticket-sla-policy-form";
import { TicketSlaPolicyCreateForm } from "@/components/app/tickets/ticket-sla-policy-create-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveWorkspace, requireAllPermissions, requireInternal } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { StatusBadge } from "@/components/app/status-badge";

export const metadata: Metadata = { title: "Ticket SLA" };

const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export default async function TicketSlaPoliciesPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requireAllPermissions(workspace, ["tickets.manage", "clients.manage"]);

  const supabase = await createClient();
  const { data: policies } = await supabase
    .from("ticket_sla_policies")
    .select(
      "id, name, priority, first_response_minutes, resolution_minutes, active, updated_at",
    )
    .eq("organization_id", BEEPA_ORG_ID)
    .order("priority");

  const byPriority = new Map(
    (policies ?? []).map((p) => [p.priority, p] as const),
  );
  const missing = PRIORITIES.filter((p) => !byPriority.has(p));

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Beepa priority SLA targets for new tickets. Existing tickets keep their due times."
      />

      <p className="text-sm text-slate">
        <Link
          href="/app/tickets"
          className="font-medium text-green-strong hover:underline"
        >
          ← Back to tickets
        </Link>
      </p>

      {!policies?.length && missing.length === 4 ? (
        <EmptyState
          icon={IconHourglass}
          title="No SLA policies"
          description="Create priority policies below, or re-run the ticket SLA seed migration."
        />
      ) : null}

      <div className="space-y-4">
        {PRIORITIES.map((priority) => {
          const policy = byPriority.get(priority);
          if (!policy) {
            return (
              <Card key={priority}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-display text-base text-navy">
                      Missing {priority} policy
                    </CardTitle>
                    <StatusBadge status={priority} />
                  </div>
                </CardHeader>
                <CardContent>
                  <TicketSlaPolicyCreateForm priority={priority} />
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={policy.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="font-display text-base text-navy">
                    {policy.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <StatusBadge status={policy.priority} />
                    <Badge variant="outline">
                      {policy.active ? "active" : "inactive"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TicketSlaPolicyForm policy={policy} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
