"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { employeeUpdateSchema } from "@/lib/validation/app";
import { updateEmployee } from "@/lib/employees/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type EmployeeInput = z.infer<typeof employeeUpdateSchema>;

const selectClass =
  "flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy";

export function EmployeeEditForm({
  defaultValues,
}: {
  defaultValues: EmployeeInput;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<EmployeeInput>({
    resolver: zodResolver(employeeUpdateSchema),
    defaultValues,
  });

  async function onSubmit(values: EmployeeInput) {
    setPending(true);
    const result = await updateEmployee(values);
    setPending(false);
    if (result.ok) toast.success(result.message);
    else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to update employee.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...form.register("employee_id")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="job_title">Job title</Label>
          <Input id="job_title" className="min-h-11" {...form.register("job_title")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hire_date">Hire date</Label>
          <Input
            id="hire_date"
            type="date"
            className="min-h-11"
            {...form.register("hire_date")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employment_status">Status</Label>
          <select
            id="employment_status"
            className={selectClass}
            {...form.register("employment_status")}
          >
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
            <option value="resigned">Resigned</option>
          </select>
          {errors.employment_status ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.employment_status.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="employment_type">Employment type</Label>
          <select
            id="employment_type"
            className={selectClass}
            {...form.register("employment_type")}
          >
            <option value="regular">Regular</option>
            <option value="probationary">Probationary</option>
            <option value="contractual">Contractual</option>
            <option value="part_time">Part time</option>
            <option value="intern">Intern</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="work_email">Work email</Label>
          <Input
            id="work_email"
            type="email"
            className="min-h-11"
            {...form.register("work_email")}
          />
          {errors.work_email ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.work_email.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="personal_email">Personal email</Label>
          <Input
            id="personal_email"
            type="email"
            className="min-h-11"
            {...form.register("personal_email")}
          />
          {errors.personal_email ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.personal_email.message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="default_timezone">Timezone</Label>
        <Input
          id="default_timezone"
          className="min-h-11"
          {...form.register("default_timezone")}
        />
        {errors.default_timezone ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.default_timezone.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save employee"}
      </Button>
    </form>
  );
}
