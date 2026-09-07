"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { issueInvoiceSchema } from "@/lib/validation/app";
import { issueInvoice } from "@/lib/billing/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type FormInput = z.input<typeof issueInvoiceSchema>;
type FormOutput = z.output<typeof issueInvoiceSchema>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function IssueInvoiceForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const defaults: FormInput = {
    client_organization_id: clients[0]?.id ?? "",
    period_start: today(),
    period_end: today(),
    issue_date: today(),
    due_date: plusDays(30),
    currency: "USD",
    description: "",
    quantity: 1,
    unit_rate: 0,
  };
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(issueInvoiceSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: FormOutput) {
    setPending(true);
    const result = await issueInvoice(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset({
        ...defaults,
        client_organization_id:
          values.client_organization_id || defaults.client_organization_id,
        description: "",
        quantity: 1,
        unit_rate: 0,
      });
      router.refresh();
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to issue invoice.");
    }
  }

  const errors = form.formState.errors;

  if (!clients.length) {
    return (
      <p className="text-sm text-slate">
        Add an active client organization before issuing invoices.
      </p>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client_organization_id">Client</Label>
        <select
          id="client_organization_id"
          className="flex min-h-11 w-full rounded-[10px] border border-line bg-white px-3 text-sm text-navy"
          {...form.register("client_organization_id")}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.client_organization_id ? (
          <p className="text-sm text-destructive">
            {errors.client_organization_id.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="period_start">Period start</Label>
          <Input
            id="period_start"
            type="date"
            {...form.register("period_start")}
          />
          {errors.period_start ? (
            <p className="text-sm text-destructive">
              {errors.period_start.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="period_end">Period end</Label>
          <Input id="period_end" type="date" {...form.register("period_end")} />
          {errors.period_end ? (
            <p className="text-sm text-destructive">
              {errors.period_end.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="issue_date">Issue date</Label>
          <Input id="issue_date" type="date" {...form.register("issue_date")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" type="date" {...form.register("due_date")} />
          {errors.due_date ? (
            <p className="text-sm text-destructive">{errors.due_date.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Line description</Label>
        <Textarea
          id="description"
          rows={2}
          placeholder="Dedicated support seat — March"
          {...form.register("description")}
        />
        {errors.description ? (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            step="0.01"
            min="0.01"
            {...form.register("quantity")}
          />
          {errors.quantity ? (
            <p className="text-sm text-destructive">{errors.quantity.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit_rate">Unit rate</Label>
          <Input
            id="unit_rate"
            type="number"
            step="0.01"
            min="0"
            {...form.register("unit_rate")}
          />
          {errors.unit_rate ? (
            <p className="text-sm text-destructive">
              {errors.unit_rate.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" maxLength={3} {...form.register("currency")} />
        </div>
      </div>

      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Issuing…" : "Issue invoice"}
      </Button>
    </form>
  );
}
