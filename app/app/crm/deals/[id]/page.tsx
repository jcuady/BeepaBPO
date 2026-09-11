import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { DealStageForm } from "@/components/app/crm/deal-stage-form";
import { ConvertDealToClientForm } from "@/components/app/crm/convert-deal-to-client-form";
import { CreateProposalForm } from "@/components/app/crm/create-proposal-form";
import { ProposalStatusForm } from "@/components/app/crm/proposal-status-form";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { can, canAll } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "CRM Deal" };

function money(value: number | null, currency: string) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export default async function CrmDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "crm.read");

  const supabase = await createClient();
  const [{ data: deal }, { data: activities }, { data: proposals }] =
    await Promise.all([
      supabase
        .from("crm_deals")
        .select(
          "id, title, stage, estimated_value, currency, expected_close_date, lost_reason, lead_id, owner_user_id, client_organization_id, created_at, updated_at, crm_leads(id, company_name, contact_name, status), organizations:client_organization_id(id, name, slug)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("crm_activities")
        .select("id, activity_type, subject, body, created_at")
        .eq("deal_id", id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("crm_proposals")
        .select("id, title, amount, currency, status, updated_at")
        .eq("deal_id", id)
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

  if (!deal) notFound();

  const canManage = can(workspace.permissions, "crm.manage");
  const canConvert = canAll(workspace.permissions, [
    "crm.manage",
    "clients.manage",
  ]);
  const lead = Array.isArray(deal.crm_leads) ? deal.crm_leads[0] : deal.crm_leads;
  const clientOrg = Array.isArray(deal.organizations)
    ? deal.organizations[0]
    : deal.organizations;

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle={deal.title}
      />

      <p className="text-sm text-slate">
        <Link
          href="/app/crm/deals"
          className="text-teal underline-offset-2 hover:underline"
        >
          ← Back to deals
        </Link>
      </p>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="font-display text-base text-navy">
              {deal.title}
            </CardTitle>
            <StatusBadge status={deal.stage} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate">
            Value:{" "}
            <span className="font-medium text-navy">
              {money(deal.estimated_value, deal.currency)}
            </span>
          </p>
          <p className="text-slate">
            Expected close:{" "}
            <span className="font-medium text-navy">
              {deal.expected_close_date
                ? format(new Date(deal.expected_close_date), "MMM d, yyyy")
                : "—"}
            </span>
          </p>
          {lead ? (
            <p className="text-slate">
              Lead:{" "}
              <Link
                href={`/app/crm/leads/${lead.id}`}
                className="font-medium text-green-strong hover:underline"
              >
                {lead.company_name}
              </Link>
            </p>
          ) : null}
          {deal.lost_reason ? (
            <p className="text-slate">
              Lost reason:{" "}
              <span className="font-medium text-navy">{deal.lost_reason}</span>
            </p>
          ) : null}
          {clientOrg ? (
            <p className="text-slate">
              Client org:{" "}
              <Link
                href="/app/clients"
                className="font-medium text-green-strong hover:underline"
              >
                {clientOrg.name}
              </Link>
            </p>
          ) : null}
          <p className="text-xs text-slate">
            Updated {format(new Date(deal.updated_at), "MMM d, yyyy HH:mm")}
          </p>
          {canManage ? (
            <div className="pt-2">
              <DealStageForm dealId={deal.id} currentStage={deal.stage} />
            </div>
          ) : null}
          {canConvert && deal.stage === "won" && !deal.client_organization_id ? (
            <div className="border-t border-line pt-4">
              <p className="mb-3 text-sm text-slate">
                Convert this won deal into an active client organization for
                portal invites and billing.
              </p>
              <ConvertDealToClientForm
                dealId={deal.id}
                defaultName={lead?.company_name || deal.title}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Proposals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!proposals?.length ? (
            <p className="text-sm text-slate">No proposals for this deal yet.</p>
          ) : (
            proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-navy">{proposal.title}</p>
                  <p className="mt-1 text-sm text-slate">
                    {money(proposal.amount, proposal.currency)}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={proposal.status} />
                  </div>
                </div>
                {canManage ? (
                  <ProposalStatusForm
                    proposalId={proposal.id}
                    currentStatus={proposal.status}
                  />
                ) : null}
              </div>
            ))
          )}
          {canManage && deal.stage !== "lost" ? (
            <div className="border-t border-line pt-4">
              <CreateProposalForm
                deals={[{ id: deal.id, label: deal.title }]}
                defaultDealId={deal.id}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base text-navy">
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activities?.length ? (
            <p className="text-sm text-slate">No activity yet.</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="border-b border-line pb-3 last:border-0">
                <p className="text-sm font-medium text-navy">{activity.subject}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate">
                  {activity.activity_type} ·{" "}
                  {format(new Date(activity.created_at), "MMM d, yyyy")}
                </p>
                {activity.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate">
                    {activity.body}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
