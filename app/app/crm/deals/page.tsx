import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { IconBriefcase } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { CreateDealForm } from "@/components/app/crm/create-deal-form";
import { DealStageForm } from "@/components/app/crm/deal-stage-form";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { stringParam, enumParam, ilikePattern } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "CRM Deals" };

const STAGES = [
  "new_lead",
  "contacted",
  "qualified",
  "discovery",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "on_hold",
  "follow_up_later",
] as const;

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

export default async function CrmDealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  requirePermission(workspace, "crm.read");

  const params = await searchParams;
  const q = stringParam(params.q);
  const stage = enumParam(params.stage, STAGES);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("crm_deals")
    .select(
      "id, title, stage, estimated_value, currency, expected_close_date, lead_id, updated_at, crm_leads(company_name)",
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  if (stage) query = query.eq("stage", stage);
  if (pattern) query = query.ilike("title", pattern);

  const [{ data: deals }, { data: leads }] = await Promise.all([
    query,
    can(workspace.permissions, "crm.manage")
      ? supabase
          .from("crm_leads")
          .select("id, company_name, contact_name")
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null }),
  ]);

  const manage = can(workspace.permissions, "crm.manage");
  const leadOptions =
    leads?.map((lead) => ({
      id: lead.id,
      label: lead.contact_name
        ? `${lead.company_name} (${lead.contact_name})`
        : lead.company_name,
    })) ?? [];

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Track opportunities through the sales pipeline."
      />

      {manage ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New deal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreateDealForm leadOptions={leadOptions} />
          </CardContent>
        </Card>
      ) : null}

      <form method="get">
        <FilterBar placeholder="Search deal title…" defaultValue={q}>
          <FilterSelect
            name="stage"
            label="Stage"
            defaultValue={stage ?? ""}
            options={[
              { value: "", label: "All stages" },
              ...STAGES.map((s) => ({
                value: s,
                label: s.replace(/_/g, " "),
              })),
            ]}
          />
        </FilterBar>
      </form>

      {!deals?.length ? (
        <EmptyState
          icon={IconBriefcase}
          title="No deals yet"
          description="Create a deal from a qualified lead or start a new opportunity."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Updated</TableHead>
                  {manage ? (
                    <TableHead className="text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => {
                  const lead = Array.isArray(deal.crm_leads)
                    ? deal.crm_leads[0]
                    : deal.crm_leads;
                  return (
                    <TableRow key={deal.id}>
                      <TableCell className="font-medium text-navy">
                        <Link
                          href={`/app/crm/deals/${deal.id}`}
                          className="hover:text-green-strong hover:underline"
                        >
                          <span className="line-clamp-2">{deal.title}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate">
                        {lead?.company_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate">
                        {money(deal.estimated_value, deal.currency)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={deal.stage} />
                      </TableCell>
                      <TableCell className="text-slate">
                        {format(new Date(deal.updated_at), "MMM d, yyyy")}
                      </TableCell>
                      {manage ? (
                        <TableCell className="text-right">
                          <DealStageForm
                            dealId={deal.id}
                            currentStage={deal.stage}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
