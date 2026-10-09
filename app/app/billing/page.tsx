import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconCoin } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, FilterSelect } from "@/components/app/filter-bar";
import { ListPager } from "@/components/app/list-pager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/app/page-container";
import { IssueInvoiceForm } from "@/components/app/billing/issue-invoice-form";
import { resolveWorkspace, requirePermission, requireInternal } from "@/lib/auth/workspace";
import { can, canAny } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { enumParam, pageParam, stringParam, ilikePattern } from "@/lib/app/search-params";

export const metadata: Metadata = { title: "Billing" };

const STATUSES = [
  "draft",
  "issued",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;
const PAGE_SIZE = 50;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");
  requireInternal(workspace);
  if (
    !canAny(workspace.permissions, ["billing.read", "billing.manage"])
  ) {
    requirePermission(workspace, "billing.read");
  }

  const params = await searchParams;
  const q = stringParam(params.q);
  const status = enumParam(params.status, STATUSES);
  const page = pageParam(params.page);
  const pattern = q ? ilikePattern(q) : undefined;

  const canIssue = can(workspace.permissions, "billing.manage");
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, period_start, period_end, due_date, total, currency, status, organizations(name)",
    )
    .order("due_date", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (pattern) query = query.ilike("invoice_number", pattern);

  const [{ data: invoices }, clientsResult] = await Promise.all([
    query,
    canIssue
      ? supabase
          .from("organizations")
          .select("id, name")
          .eq("type", "client")
          .eq("status", "active")
          .order("name")
          .limit(200)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const clients = clientsResult.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Billing"
        name={workspace.profile.first_name}
        subtitle="Issue invoices and open a row to record payments."
      />

      {canIssue ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Issue invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <IssueInvoiceForm clients={clients} />
          </CardContent>
        </Card>
      ) : null}

      <form method="get">
        <FilterBar placeholder="Search invoice number…" defaultValue={q}>
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
            ]}
          />
        </FilterBar>
      </form>

      {!invoices?.length ? (
        <EmptyState
          icon={IconCoin}
          title="No invoices"
          description={
            canIssue
              ? "Use Issue invoice above to create the first one. Open a row later to record payments."
              : "Issued invoices appear here when finance publishes them."
          }
        />
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => {
            const org = invoice.organizations as { name: string } | null;
            return (
              <Card key={invoice.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-navy">
                      <Link
                        href={`/app/billing/${invoice.id}`}
                        className="hover:underline"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </p>
                    <p className="text-base text-slate sm:text-sm">
                      {org?.name ?? "Client"} ·{" "}
                      {format(new Date(invoice.period_start), "MMM d")} –{" "}
                      {format(new Date(invoice.period_end), "MMM d, yyyy")} · Due{" "}
                      {format(new Date(invoice.due_date), "MMM d")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      <p className="font-display font-semibold text-navy">
                        {invoice.currency}{" "}
                        {Number(invoice.total).toLocaleString()}
                      </p>
                      <Badge variant="outline" className="mt-1 capitalize">
                        {invoice.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <Link
                      href={`/app/billing/${invoice.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ListPager
        page={page}
        pageSize={PAGE_SIZE}
        rowCount={invoices?.length ?? 0}
        query={{ q, status }}
      />
    </PageContainer>
  );
}