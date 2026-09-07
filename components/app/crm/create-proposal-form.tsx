"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { crmProposalSchema } from "@/lib/validation/app";
import { createCrmProposal } from "@/lib/crm/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type FormInput = z.input<typeof crmProposalSchema>;
type FormOutput = z.output<typeof crmProposalSchema>;

export function CreateProposalForm({
  deals,
  defaultDealId = "",
}: {
  deals: { id: string; label: string }[];
  defaultDealId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const lockDeal = Boolean(defaultDealId);
  const defaults: FormInput = {
    deal_id: defaultDealId || deals[0]?.id || "",
    title: "",
    amount: "",
    currency: "USD",
  };
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(crmProposalSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: FormOutput) {
    setPending(true);
    const result = await createCrmProposal(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset({
        ...defaults,
        deal_id: values.deal_id,
        title: "",
        amount: "",
      });
      router.refresh();
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create proposal.");
    }
  }

  const errors = form.formState.errors;

  if (!deals.length && !lockDeal) {
    return (
      <p className="text-sm text-slate">
        Create a deal before adding a proposal.
      </p>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {lockDeal ? (
        <input type="hidden" {...form.register("deal_id")} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="proposal-deal">Deal</Label>
          <select
            id="proposal-deal"
            className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
            {...form.register("deal_id")}
          >
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          {errors.deal_id ? (
            <p className="text-sm text-destructive">{errors.deal_id.message}</p>
          ) : null}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="proposal-title">Title</Label>
        <Input id="proposal-title" {...form.register("title")} />
        {errors.title ? (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="proposal-amount">Amount</Label>
          <Input
            id="proposal-amount"
            inputMode="decimal"
            placeholder="12000"
            {...form.register("amount")}
          />
          {errors.amount ? (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="proposal-currency">Currency</Label>
          <Input
            id="proposal-currency"
            maxLength={3}
            {...form.register("currency")}
          />
        </div>
      </div>

      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Create proposal"}
      </Button>
    </form>
  );
}
