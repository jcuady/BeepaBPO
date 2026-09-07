"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { invoicePaymentSchema, issueInvoiceSchema } from "@/lib/validation/app";
import type { Database } from "@/types/database";

type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

function nextInvoiceStatus(
  total: number,
  paidTotal: number,
  current: InvoiceStatus,
): InvoiceStatus {
  if (current === "void" || current === "draft") return current;
  if (paidTotal <= 0) return current === "overdue" ? "overdue" : current;
  if (paidTotal + 0.001 >= total) return "paid";
  return "partially_paid";
}

function makeInvoiceNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `INV-${ymd}-${suffix}`;
}

function fieldErrors(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
): ActionResult {
  return {
    ok: false,
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    error: "Please check the form and try again.",
  };
}

export async function issueInvoice(input: unknown): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "billing.manage");

  const parsed = issueInvoiceSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);

  const quantity = parsed.data.quantity;
  const unitRate = parsed.data.unit_rate;
  const amount = Math.round(quantity * unitRate * 100) / 100;
  if (amount <= 0) {
    return {
      ok: false,
      fieldErrors: { unit_rate: ["Line amount must be greater than zero."] },
      error: "Line amount must be greater than zero.",
    };
  }

  const supabase = await createClient();
  const { data: clientOrg } = await supabase
    .from("organizations")
    .select("id, type, status")
    .eq("id", parsed.data.client_organization_id)
    .maybeSingle();

  if (!clientOrg || clientOrg.type !== "client" || clientOrg.status !== "active") {
    return { ok: false, error: "Select an active client organization." };
  }

  let invoiceId: string | null = null;
  let invoiceNumber = makeInvoiceNumber();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        client_organization_id: parsed.data.client_organization_id,
        invoice_number: invoiceNumber,
        period_start: parsed.data.period_start,
        period_end: parsed.data.period_end,
        issue_date: parsed.data.issue_date,
        due_date: parsed.data.due_date,
        subtotal: amount,
        adjustments: 0,
        total: amount,
        currency: parsed.data.currency.toUpperCase(),
        status: "issued",
      })
      .select("id, invoice_number")
      .single();

    if (!error && invoice) {
      invoiceId = invoice.id;
      invoiceNumber = invoice.invoice_number;
      break;
    }
    if (error?.code === "23505") {
      invoiceNumber = makeInvoiceNumber();
      continue;
    }
    return { ok: false, error: error?.message ?? "Unable to create invoice." };
  }

  if (!invoiceId) {
    return { ok: false, error: "Unable to allocate a unique invoice number." };
  }

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    description: parsed.data.description.trim(),
    quantity,
    unit_rate: unitRate,
    amount,
  });

  if (itemError) {
    await supabase.from("invoices").delete().eq("id", invoiceId);
    return {
      ok: false,
      error: itemError.message ?? "Unable to add invoice line item.",
    };
  }

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: parsed.data.client_organization_id,
      action: "invoice.issue",
      entityType: "invoice",
      entityId: invoiceId,
      after: {
        invoice_number: invoiceNumber,
        total: amount,
        status: "issued",
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/billing");
  revalidatePath(`/app/billing/${invoiceId}`);
  revalidatePath("/app/client/billing");
  return {
    ok: true,
    message: `Invoice ${invoiceNumber} issued.`,
  };
}

export async function recordInvoicePayment(
  input: unknown,
): Promise<ActionResult> {
  const workspace = await resolveWorkspace();
  if (!workspace) return { ok: false, error: "You must be signed in." };
  requirePermission(workspace, "billing.manage");

  const parsed = invoicePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, total, status, client_organization_id, invoice_number")
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();

  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }
  if (invoice.status === "void" || invoice.status === "draft") {
    return {
      ok: false,
      error: "Payments cannot be recorded on draft or void invoices.",
    };
  }
  if (invoice.status === "paid") {
    return { ok: false, error: "Invoice is already fully paid." };
  }

  const paidAt =
    parsed.data.paid_at && parsed.data.paid_at.trim()
      ? new Date(parsed.data.paid_at).toISOString()
      : new Date().toISOString();

  const { error: payError } = await supabase.from("invoice_payments").insert({
    invoice_id: invoice.id,
    amount: parsed.data.amount,
    paid_at: paidAt,
    reference: parsed.data.reference?.trim() || null,
    method: parsed.data.method?.trim() || null,
  });

  if (payError) {
    return {
      ok: false,
      error: payError.message ?? "Unable to record payment.",
    };
  }

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoice.id);

  const paidTotal = (payments ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );
  const status = nextInvoiceStatus(
    Number(invoice.total),
    paidTotal,
    invoice.status,
  );

  if (status !== invoice.status) {
    const { error: statusError } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoice.id);
    if (statusError) {
      return {
        ok: false,
        error:
          statusError.message ??
          "Payment saved but invoice status could not be updated.",
      };
    }
  }

  try {
    const { logAudit } = await import("@/lib/audit/log");
    await logAudit(supabase, {
      actorUserId: workspace.user.id,
      organizationId: invoice.client_organization_id,
      action: "invoice.payment",
      entityType: "invoice",
      entityId: invoice.id,
      after: {
        amount: parsed.data.amount,
        paid_total: paidTotal,
        status,
      },
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/app/billing");
  revalidatePath(`/app/billing/${invoice.id}`);
  revalidatePath("/app/client/billing");
  revalidatePath(`/app/client/billing/${invoice.id}`);
  return {
    ok: true,
    message: `Payment recorded on ${invoice.invoice_number}.`,
  };
}
