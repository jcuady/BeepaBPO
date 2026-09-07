import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { IconCoin } from "@tabler/icons-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";

export const metadata: Metadata = { title: "Billing" };

export default async function ClientBillingPage() {
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  const supabase = await createClient();

  let invoices: {
    id: string;
    invoice_number: string;
    period_start: string;
    period_end: string;
    due_date: string;
    total: number;
    currency: string;
    status: string;
  }[] = [];

  if (clientOrgId) {
    const { data } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, period_start, period_end, due_date, total, currency, status",
      )
      .eq("client_organization_id", clientOrgId)
      .order("due_date", { ascending: false })
      .limit(24);
    invoices = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Open an invoice for line items and payment history."
      />
      {invoices.length === 0 ? (
        <EmptyState
          icon={IconCoin}
          title="No billing records"
          description="Issued invoices for your account will appear here."
        />
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">
                    <Link
                      href={`/app/client/billing/${invoice.id}`}
                      className="hover:underline"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </p>
                  <p className="text-sm text-slate">
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
                    href={`/app/client/billing/${invoice.id}`}
                    className="text-sm font-medium text-green-strong hover:underline"
                  >
                    View
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
