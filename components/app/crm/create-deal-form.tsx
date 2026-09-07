"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { crmDealSchema } from "@/lib/validation/app";
import { createCrmDeal } from "@/lib/crm/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type DealInput = z.infer<typeof crmDealSchema>;

export function CreateDealForm({
  defaultTitle = "",
  leadId,
  leadOptions,
}: {
  defaultTitle?: string;
  leadId?: string;
  leadOptions?: { id: string; label: string }[];
}) {
  const [pending, setPending] = useState(false);
  const defaults: DealInput = {
    title: defaultTitle,
    lead_id: leadId ?? "",
    estimated_value: "",
    currency: "USD",
    expected_close_date: "",
  };
  const form = useForm<DealInput>({
    resolver: zodResolver(crmDealSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: DealInput) {
    setPending(true);
    const result = await createCrmDeal(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset({
        ...defaults,
        title: leadId ? defaultTitle : "",
        lead_id: leadId ?? "",
      });
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create deal.");
    }
  }

  const errors = form.formState.errors;
  const lockLead = Boolean(leadId);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="deal-title">Deal title</Label>
        <Input id="deal-title" {...form.register("title")} />
        {errors.title ? (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        ) : null}
      </div>

      {lockLead ? (
        <input type="hidden" {...form.register("lead_id")} />
      ) : leadOptions?.length ? (
        <div className="space-y-2">
          <Label htmlFor="deal-lead">Linked lead (optional)</Label>
          <select
            id="deal-lead"
            className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
            {...form.register("lead_id")}
          >
            <option value="">No linked lead</option>
            {leadOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deal-value">Estimated value</Label>
          <Input
            id="deal-value"
            inputMode="decimal"
            placeholder="12000"
            {...form.register("estimated_value")}
          />
          {errors.estimated_value ? (
            <p className="text-sm text-destructive">
              {errors.estimated_value.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-currency">Currency</Label>
          <Input
            id="deal-currency"
            maxLength={3}
            {...form.register("currency")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="deal-close">Expected close date</Label>
        <Input
          id="deal-close"
          type="date"
          {...form.register("expected_close_date")}
        />
      </div>

      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Create deal"}
      </Button>
    </form>
  );
}
