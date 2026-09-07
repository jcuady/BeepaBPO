"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cashAdvanceSchema } from "@/lib/validation/app";
import { createCashAdvanceRequest } from "@/lib/cash-advance/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CashAdvanceForm() {
  const [pending, setPending] = useState(false);
  const form = useForm({
    resolver: zodResolver(cashAdvanceSchema),
  });

  async function onSubmit(values: Record<string, unknown>) {
    setPending(true);
    const result = await createCashAdvanceRequest(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset();
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to submit request.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="requested_amount">Amount</Label>
        <Input
          id="requested_amount"
          type="number"
          step="0.01"
          min="0"
          {...form.register("requested_amount")}
        />
        {errors.requested_amount && (
          <p className="text-sm text-destructive">
            {errors.requested_amount.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="requested_repayment_periods">Repayment periods</Label>
        <Input
          id="requested_repayment_periods"
          type="number"
          min="1"
          max="24"
          {...form.register("requested_repayment_periods")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Textarea id="reason" rows={3} {...form.register("reason")} />
        {errors.reason && (
          <p className="text-sm text-destructive">{errors.reason.message}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Submitting…" : "Submit cash advance request"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => form.reset()}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
