"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ticketSchema } from "@/lib/validation/app";
import { createTicket } from "@/lib/tickets/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type TicketInput = z.infer<typeof ticketSchema>;

const CATEGORIES = [
  "general",
  "employee_concern",
  "attendance",
  "schedule_change",
  "performance",
  "payroll",
  "hr",
  "technical",
] as const;

const defaults = { priority: "normal" as const };

export function CreateTicketForm() {
  const [pending, setPending] = useState(false);
  const form = useForm<TicketInput>({
    resolver: zodResolver(ticketSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: TicketInput) {
    setPending(true);
    const result = await createTicket(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Ticket created.");
      form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create ticket.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
          {...form.register("category")}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="text-sm text-destructive">{errors.category.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" {...form.register("subject")} />
        {errors.subject && (
          <p className="text-sm text-destructive">{errors.subject.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} {...form.register("description")} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Creating…" : "Create ticket"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => form.reset(defaults)}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
