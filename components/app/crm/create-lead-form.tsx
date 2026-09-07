"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { crmLeadSchema } from "@/lib/validation/app";
import { createCrmLead } from "@/lib/crm/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type LeadInput = z.infer<typeof crmLeadSchema>;

const defaults = { source: "manual" as const, notes: "" };

export function CreateLeadForm() {
  const [pending, setPending] = useState(false);
  const form = useForm<LeadInput>({
    resolver: zodResolver(crmLeadSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: LeadInput) {
    setPending(true);
    const result = await createCrmLead(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create lead.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company_name">Company</Label>
        <Input id="company_name" {...form.register("company_name")} />
        {errors.company_name && (
          <p className="text-sm text-destructive">{errors.company_name.message}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact_name">Contact name</Label>
          <Input id="contact_name" {...form.register("contact_name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_email">Email</Label>
          <Input id="contact_email" type="email" {...form.register("contact_email")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact_phone">Phone</Label>
          <Input id="contact_phone" {...form.register("contact_phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" {...form.register("industry")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...form.register("notes")} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : "Create lead"}
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
