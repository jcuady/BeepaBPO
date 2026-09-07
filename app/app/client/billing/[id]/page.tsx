import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceDetailView } from "@/components/app/billing/invoice-detail-view";
import { getClientOrganizationId } from "@/lib/organizations/client";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice" };

export default async function ClientInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await resolveWorkspace();
  if (!workspace) redirect("/login");

  const clientOrgId = getClientOrganizationId(workspace);
  if (!clientOrgId) redirect("/app/client/billing");

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, period_start, period_end, issue_date, due_date, subtotal, adjustments, total, currency, status, client_organization_id, organizations(name)",
    )
    .eq("id", id)
    .eq("client_organization_id", clientOrgId)
    .maybeSingle();

  if (!invoice) notFound();

  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_rate, amount")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invoice_payments")
      .select("id, amount, paid_at, reference, method")
      .eq("invoice_id", id)
      .order("paid_at", { ascending: false }),
  ]);

  return (
    <PageContainer size="narrow">
      <PageHeader
        name={workspace.profile.first_name}
        subtitle="Invoice detail"
      />
      <InvoiceDetailView
        invoice={{
          ...invoice,
          organizations: invoice.organizations as { name: string } | null,
        }}
        items={items ?? []}
        payments={payments ?? []}
        backHref="/app/client/billing"
        canRecordPayment={false}
      />
    </PageContainer>
  );
}
