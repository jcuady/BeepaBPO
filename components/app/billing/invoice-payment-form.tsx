"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { recordInvoicePayment } from "@/lib/billing/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  paid_at: z.string().optional(),
  reference: z.string().max(120).optional(),
  method: z.string().max(80).optional(),
});

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function InvoicePaymentForm({
  invoiceId,
  currency,
  balanceDue,
}: {
  invoiceId: string;
  currency: string;
  balanceDue: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: balanceDue > 0 ? Number(balanceDue.toFixed(2)) : undefined,
      method: "bank_transfer",
      reference: "",
      paid_at: new Date().toISOString().slice(0, 10),
    },
  });

  async function onSubmit(values: FormOutput) {
    setPending(true);
    const result = await recordInvoicePayment({
      ...values,
      invoice_id: invoiceId,
      paid_at: values.paid_at
        ? new Date(values.paid_at).toISOString()
        : undefined,
    });
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset({
        amount: undefined,
        method: "bank_transfer",
        reference: "",
        paid_at: new Date().toISOString().slice(0, 10),
      });
      router.refresh();
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to record payment.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <p className="text-sm text-slate">
        Balance due:{" "}
        <span className="font-medium text-navy">
          {currency}{" "}
          {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            {...form.register("amount")}
          />
          {errors.amount ? (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paid_at">Paid on</Label>
          <Input id="paid_at" type="date" {...form.register("paid_at")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="method">Method</Label>
          <Input
            id="method"
            placeholder="bank_transfer"
            {...form.register("method")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            placeholder="Wire / check no."
            {...form.register("reference")}
          />
        </div>
      </div>
      <Button type="submit" size="sm" className="min-h-9" disabled={pending}>
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}
