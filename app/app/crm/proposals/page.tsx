import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { IconFileText } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { CreateProposalForm } from "@/components/app/crm/create-proposal-form";
import { ProposalStatusForm } from "@/components/app/crm/proposal-status-form";
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

export const metadata: Metadata = { title: "CRM Proposals" };

const STATUSES = ["draft", "sent", "accepted", "rejected", "withdrawn"] as const;

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

export default async function CrmProposalsPage({
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
  const status = enumParam(params.status, STATUSES);
  const pattern = q ? ilikePattern(q) : undefined;
  const manage = can(workspace.permissions, "crm.manage");

  const supabase = await createClient();
  let query = supabase
    .from("crm_proposals")
    .select(
      "id, title, amount, currency, status, sent_at, updated_at, deal_id, crm_deals(id, title)",
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);
  if (pattern) query = query.ilike("title", pattern);

  const [{ data: proposals }, dealsResult] = await Promise.all([
    query,
    manage
      ? supabase
          .from("crm_deals")
          .select("id, title, stage")
          .not("stage", "in", "(lost,won)")
          .order("updated_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null }),
  ]);

  const dealOptions =
    dealsResult.data?.map((d) => ({
      id: d.id,
      label: `${d.title} (${d.stage.replace(/_/g, " ")})`,
    })) ?? [];

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Draft and track sales proposals linked to deals."
      />

      {manage ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New proposal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreateProposalForm deals={dealOptions} />
          </CardContent>
        </Card>
      ) : null}

      <form method="get">
        <FilterBar placeholder="Search proposal title…" defaultValue={q}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({
                value: s,
                label: s.replace(/_/g, " "),
              })),
            ]}
          />
        </FilterBar>
      </form>

      {!proposals?.length ? (
        <EmptyState
          icon={IconFileText}
          title="No proposals yet"
          description={
            manage
              ? "Create a proposal for an open deal above."
              : "Proposals appear here when sales drafts them."
          }
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  {manage ? (
                    <TableHead className="text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((row) => {
                  const deal = Array.isArray(row.crm_deals)
                    ? row.crm_deals[0]
                    : row.crm_deals;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-navy">
                        <span className="line-clamp-2">{row.title}</span>
                      </TableCell>
                      <TableCell className="text-slate">
                        {deal ? (
                          <Link
                            href={`/app/crm/deals/${deal.id}`}
                            className="hover:text-green-strong hover:underline"
                          >
                            {deal.title}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-slate">
                        {money(row.amount, row.currency)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-slate">
                        {format(new Date(row.updated_at), "MMM d, yyyy")}
                      </TableCell>
                      {manage ? (
                        <TableCell className="text-right">
                          <ProposalStatusForm
                            proposalId={row.id}
                            currentStatus={row.status}
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
