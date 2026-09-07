"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ticketSlaPolicyUpdateSchema } from "@/lib/validation/app";
import { updateTicketSlaPolicy } from "@/lib/tickets/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type FormInput = z.input<typeof ticketSlaPolicyUpdateSchema>;
type FormOutput = z.output<typeof ticketSlaPolicyUpdateSchema>;

export function TicketSlaPolicyForm({
  policy,
}: {
  policy: {
    id: string;
    name: string;
    priority: string;
    first_response_minutes: number;
    resolution_minutes: number;
    active: boolean;
  };
}) {
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(policy.active);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(ticketSlaPolicyUpdateSchema),
    defaultValues: {
      id: policy.id,
      name: policy.name,
      first_response_minutes: policy.first_response_minutes,
      resolution_minutes: policy.resolution_minutes,
      active: policy.active,
    },
  });

  async function onSubmit(values: FormOutput) {
    setPending(true);
    const result = await updateTicketSlaPolicy({ ...values, active });
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to save SLA policy.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...form.register("id")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`sla-name-${policy.id}`}>Name</Label>
          <Input id={`sla-name-${policy.id}`} {...form.register("name")} />
          {errors.name ? (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`sla-fr-${policy.id}`}>
            First response (minutes)
          </Label>
          <Input
            id={`sla-fr-${policy.id}`}
            type="number"
            min={1}
            {...form.register("first_response_minutes", { valueAsNumber: true })}
          />
          {errors.first_response_minutes ? (
            <p className="text-sm text-destructive">
              {errors.first_response_minutes.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`sla-res-${policy.id}`}>
            Resolution (minutes)
          </Label>
          <Input
            id={`sla-res-${policy.id}`}
            type="number"
            min={1}
            {...form.register("resolution_minutes", { valueAsNumber: true })}
          />
          {errors.resolution_minutes ? (
            <p className="text-sm text-destructive">
              {errors.resolution_minutes.message}
            </p>
          ) : null}
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-navy">
        <input
          type="checkbox"
          className="size-4 rounded border-line"
          checked={active}
          onChange={(e) => {
            setActive(e.target.checked);
            form.setValue("active", e.target.checked);
          }}
        />
        Active (used for new tickets of priority “{policy.priority}”)
      </label>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save policy"}
      </Button>
    </form>
  );
}
