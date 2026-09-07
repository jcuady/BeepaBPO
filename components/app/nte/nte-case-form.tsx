"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { nteCaseSchema } from "@/lib/validation/app";
import { createNteCase } from "@/lib/hr/nte-actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type Input = z.infer<typeof nteCaseSchema>;

export function NteCaseForm({
  employees,
}: {
  employees: { id: string; label: string }[];
}) {
  const [pending, setPending] = useState(false);
  const defaults = {
    employee_id: employees[0]?.id ?? "",
    incident_date: new Date().toISOString().slice(0, 10),
    incident_type: "",
    subject: "",
    description: "",
    response_due_at: "",
  };
  const form = useForm<Input>({
    resolver: zodResolver(nteCaseSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: Input) {
    setPending(true);
    const result = await createNteCase(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset({
        ...defaults,
        employee_id: form.getValues("employee_id") || defaults.employee_id,
        incident_date: new Date().toISOString().slice(0, 10),
      });
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create NTE.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="employee_id">Employee</Label>
        <select
          id="employee_id"
          className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm"
          {...form.register("employee_id")}
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.label}
            </option>
          ))}
        </select>
        {errors.employee_id ? (
          <p className="text-sm text-destructive">{errors.employee_id.message}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="incident_date">Incident date</Label>
          <Input
            id="incident_date"
            type="date"
            className="min-h-11"
            {...form.register("incident_date")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="incident_type">Incident type</Label>
          <Input
            id="incident_type"
            className="min-h-11"
            {...form.register("incident_type")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" className="min-h-11" {...form.register("subject")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} {...form.register("description")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="response_due_at">Response due (optional)</Label>
        <Input
          id="response_due_at"
          type="datetime-local"
          className="min-h-11"
          {...form.register("response_due_at")}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Creating…" : "Create NTE case"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() =>
            form.reset({
              ...defaults,
              incident_date: new Date().toISOString().slice(0, 10),
            })
          }
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
