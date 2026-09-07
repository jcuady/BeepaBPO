import { format } from "date-fns";
import Link from "next/link";
import { InvoicePaymentForm } from "@/components/app/billing/invoice-payment-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InvoiceDetail = {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  adjustments: number;
  total: number;
  currency: string;
  status: string;
  client_organization_id: string;
  organizations?: { name: string } | null;
};

export type InvoiceItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit_rate: number;
  amount: number;
};

export type InvoicePaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  reference: string | null;
  method: string | null;
};

export function InvoiceDetailView({
  invoice,
  items,
  payments,
  backHref,
  canRecordPayment,
}: {
  invoice: InvoiceDetail;
  items: InvoiceItemRow[];
  payments: InvoicePaymentRow[];
  backHref: string;
  canRecordPayment: boolean;
}) {
  const paidTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(0, Number(invoice.total) - paidTotal);
  const clientName = invoice.organizations?.name;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="font-display text-base text-navy">
              {invoice.invoice_number}
            </CardTitle>
            <p className="mt-1 text-sm text-slate">
              {clientName ? `${clientName} · ` : null}
              Period {format(new Date(invoice.period_start), "MMM d")} –{" "}
              {format(new Date(invoice.period_end), "MMM d, yyyy")}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">
            {invoice.status.replace(/_/g, " ")}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-slate sm:grid-cols-2">
          <p>
            Issued{" "}
            <span className="font-medium text-navy">
              {format(new Date(invoice.issue_date), "MMM d, yyyy")}
            </span>
          </p>
          <p>
            Due{" "}
            <span className="font-medium text-navy">
              {format(new Date(invoice.due_date), "MMM d, yyyy")}
            </span>
          </p>
          <p>
            Subtotal{" "}
            <span className="font-medium text-navy">
              {invoice.currency} {Number(invoice.subtotal).toLocaleString()}
            </span>
          </p>
          <p>
            Total{" "}
            <span className="font-display text-lg font-bold text-navy">
              {invoice.currency} {Number(invoice.total).toLocaleString()}
            </span>
          </p>
          <p>
            Paid{" "}
            <span className="font-medium text-navy">
              {invoice.currency} {paidTotal.toLocaleString()}
            </span>
          </p>
          <p>
            Balance{" "}
            <span className="font-medium text-navy">
              {invoice.currency} {balanceDue.toLocaleString()}
            </span>
          </p>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold text-navy">
          Line items
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate">No line items on this invoice.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">
                        {Number(item.quantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.unit_rate).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.amount).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold text-navy">
          Payments
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate">No payments recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div>
                    <p className="font-medium text-navy">
                      {invoice.currency}{" "}
                      {Number(payment.amount).toLocaleString()}
                    </p>
                    <p className="text-slate">
                      {format(new Date(payment.paid_at), "MMM d, yyyy")}
                      {payment.method ? ` · ${payment.method}` : ""}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {canRecordPayment &&
      balanceDue > 0 &&
      invoice.status !== "void" &&
      invoice.status !== "draft" ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base text-navy">
              Record payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InvoicePaymentForm
              invoiceId={invoice.id}
              currency={invoice.currency}
              balanceDue={balanceDue}
            />
          </CardContent>
        </Card>
      ) : null}

      <Link
        href={backHref}
        className="text-sm font-medium text-green-strong hover:underline"
      >
        ← Back to billing
      </Link>
    </div>
  );
}
