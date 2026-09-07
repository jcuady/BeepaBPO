"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ticketSlaPolicyCreateSchema } from "@/lib/validation/app";
import { createTicketSlaPolicy } from "@/lib/tickets/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type FormInput = z.input<typeof ticketSlaPolicyCreateSchema>;
type FormOutput = z.output<typeof ticketSlaPolicyCreateSchema>;

const DEFAULTS: Record<
  FormOutput["priority"],
  Pick<FormOutput, "name" | "first_response_minutes" | "resolution_minutes">
> = {
  low: {
    name: "Low — 48h resolve",
    first_response_minutes: 480,
    resolution_minutes: 2880,
  },
  normal: {
    name: "Normal — 24h resolve",
    first_response_minutes: 240,
    resolution_minutes: 1440,
  },
  high: {
    name: "High — 8h resolve",
    first_response_minutes: 60,
    resolution_minutes: 480,
  },
  urgent: {
    name: "Urgent — 4h resolve",
    first_response_minutes: 30,
    resolution_minutes: 240,
  },
};

export function TicketSlaPolicyCreateForm({
  priority,
}: {
  priority: FormOutput["priority"];
}) {
  const defaults = DEFAULTS[priority];
  const [pending, setPending] = useState(false);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(ticketSlaPolicyCreateSchema),
    defaultValues: {
      priority,
      ...defaults,
      active: true,
    },
  });

  async function onSubmit(values: FormOutput) {
    setPending(true);
    const result = await createTicketSlaPolicy(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create SLA policy.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...form.register("priority")} />
      <div className="space-y-2">
        <Label htmlFor={`sla-create-name-${priority}`}>Name</Label>
        <Input id={`sla-create-name-${priority}`} {...form.register("name")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`sla-create-fr-${priority}`}>
            First response (minutes)
          </Label>
          <Input
            id={`sla-create-fr-${priority}`}
            type="number"
            min={1}
            {...form.register("first_response_minutes", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`sla-create-res-${priority}`}>
            Resolution (minutes)
          </Label>
          <Input
            id={`sla-create-res-${priority}`}
            type="number"
            min={1}
            {...form.register("resolution_minutes", { valueAsNumber: true })}
          />
        </div>
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Creating…" : `Create ${priority} policy`}
      </Button>
    </form>
  );
}
