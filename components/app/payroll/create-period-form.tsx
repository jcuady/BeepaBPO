"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createPayrollPeriodSchema } from "@/lib/validation/app";
import { createPayrollPeriod } from "@/lib/payroll/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type FormInput = z.input<typeof createPayrollPeriodSchema>;
type FormOutput = z.output<typeof createPayrollPeriodSchema>;

function monthDefaults() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  const pay = new Date(Date.UTC(y, m + 1, 5));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const name = start.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    name: `${name} payroll`,
    start_date: fmt(start),
    end_date: fmt(end),
    pay_date: fmt(pay),
    seed_records: true,
  };
}

export function CreatePayrollPeriodForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const defaults = monthDefaults();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createPayrollPeriodSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: FormOutput) {
    setPending(true);
    const result = await createPayrollPeriod(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset(monthDefaults());
      router.refresh();
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create period.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Period name</Label>
        <Input id="name" {...form.register("name")} />
        {errors.name ? (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start</Label>
          <Input id="start_date" type="date" {...form.register("start_date")} />
          {errors.start_date ? (
            <p className="text-sm text-destructive">
              {errors.start_date.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End</Label>
          <Input id="end_date" type="date" {...form.register("end_date")} />
          {errors.end_date ? (
            <p className="text-sm text-destructive">{errors.end_date.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay_date">Pay date</Label>
          <Input id="pay_date" type="date" {...form.register("pay_date")} />
          {errors.pay_date ? (
            <p className="text-sm text-destructive">{errors.pay_date.message}</p>
          ) : null}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate">
        <input
          type="checkbox"
          className="size-4 rounded border-line"
          {...form.register("seed_records")}
        />
        Seed draft records for active employees
      </label>

      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Creating…" : "Create period"}
      </Button>
    </form>
  );
}
