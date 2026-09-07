"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { leaveRequestSchema } from "@/lib/validation/app";
import { createLeaveRequest } from "@/lib/leave/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

type LeaveTypeOption = { id: string; name: string };

const defaults = { reason: "" } as const;

export function LeaveRequestForm({
  leaveTypes,
}: {
  leaveTypes: LeaveTypeOption[];
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<LeaveRequestInput>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: { ...defaults },
  });

  async function onSubmit(values: LeaveRequestInput) {
    setPending(true);
    const result = await createLeaveRequest(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Leave request submitted.");
      form.reset({ ...defaults });
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to submit leave request.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="leave_type_id">Leave type</Label>
        <select
          id="leave_type_id"
          className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
          {...form.register("leave_type_id")}
        >
          <option value="">Select type…</option>
          {leaveTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {errors.leave_type_id && (
          <p className="text-sm text-destructive">{errors.leave_type_id.message}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" type="date" {...form.register("start_date")} />
          {errors.start_date && (
            <p className="text-sm text-destructive">{errors.start_date.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End date</Label>
          <Input id="end_date" type="date" {...form.register("end_date")} />
          {errors.end_date && (
            <p className="text-sm text-destructive">{errors.end_date.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea id="reason" rows={3} {...form.register("reason")} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Submitting…" : "Submit leave request"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => form.reset({ ...defaults })}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
