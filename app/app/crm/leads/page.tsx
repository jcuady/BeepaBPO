import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconBuilding } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { CreateLeadForm } from "@/components/app/crm/create-lead-form";
import { LeadStatusForm } from "@/components/app/crm/lead-status-form";
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
import { createClient } from "@/lib/supabase/server";
import { stringParam, enumParam, ilikePattern, pageParam } from "@/lib/app/search-params";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "CRM Leads" };

const STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
  "lost",
] as const;

const PAGE_SIZE = 50;

export default async function CrmLeadsPage({
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
  const page = pageParam(params.page);
  const pattern = q ? ilikePattern(q) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("crm_leads")
    .select(
      "id, company_name, contact_name, contact_email, status, source, created_at",
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (pattern) {
    query = query.or(
      `company_name.ilike.${pattern},contact_name.ilike.${pattern},contact_email.ilike.${pattern}`,
    );
  }

  const { data: leads } = await query;
  const manage = canManage(workspace);

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Track inbound leads and pipeline status."
      />

      {manage && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              New lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreateLeadForm />
          </CardContent>
        </Card>
      )}

      <form method="get">
        <FilterBar placeholder="Search company or contact…" defaultValue={q}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s, label: s })),
            ]}
          />
        </FilterBar>
      </form>

      {!leads?.length ? (
        <EmptyState
          icon={IconBuilding}
          title="No leads found"
          description="Leads from the website and manual entry will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-line bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                {manage ? <TableHead>Update</TableHead> : null}
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium text-navy">
                    <Link
                      href={`/app/crm/leads/${lead.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {lead.company_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate">
                    {lead.contact_name ?? "—"}
                    {lead.contact_email ? (
                      <span className="block text-xs">{lead.contact_email}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  {manage ? (
                    <TableCell>
                      <LeadStatusForm
                        leadId={lead.id}
                        currentStatus={lead.status}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="capitalize text-slate">
                    {lead.source}
                  </TableCell>
                  <TableCell className="text-slate">
                    {format(new Date(lead.created_at), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={leads?.length ?? 0}
        query={{ q, status }}
      />
    </PageContainer>
  );
}

function canManage(
  workspace: NonNullable<Awaited<ReturnType<typeof resolveWorkspace>>>,
) {
  return workspace.permissions.has("crm.manage");
}
