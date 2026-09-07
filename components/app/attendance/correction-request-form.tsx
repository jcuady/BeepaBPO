"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { attendanceCorrectionSchema } from "@/lib/validation/app";
import { createAttendanceCorrection } from "@/lib/attendance/corrections";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import type { z } from "zod";

type CorrectionInput = z.infer<typeof attendanceCorrectionSchema>;

type RecordOption = {
  id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
};

export function AttendanceCorrectionForm({
  records,
}: {
  records: RecordOption[];
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<CorrectionInput>({
    resolver: zodResolver(attendanceCorrectionSchema),
  });

  async function onSubmit(values: CorrectionInput) {
    setPending(true);
    const result = await createAttendanceCorrection(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset();
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to submit correction.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="attendance_record_id">Attendance record</Label>
        <select
          id="attendance_record_id"
          className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
          {...form.register("attendance_record_id")}
        >
          <option value="">Select a date…</option>
          {records.map((record) => (
            <option key={record.id} value={record.id}>
              {format(new Date(record.work_date), "MMM d, yyyy")} —{" "}
              {record.clock_in_at
                ? format(new Date(record.clock_in_at), "h:mm a")
                : "—"}{" "}
              to{" "}
              {record.clock_out_at
                ? format(new Date(record.clock_out_at), "h:mm a")
                : "—"}
            </option>
          ))}
        </select>
        {errors.attendance_record_id && (
          <p className="text-sm text-destructive">
            {errors.attendance_record_id.message}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="requested_clock_in_at">Correct clock-in</Label>
          <Input
            id="requested_clock_in_at"
            type="datetime-local"
            {...form.register("requested_clock_in_at")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="requested_clock_out_at">Correct clock-out</Label>
          <Input
            id="requested_clock_out_at"
            type="datetime-local"
            {...form.register("requested_clock_out_at")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Textarea id="reason" rows={3} {...form.register("reason")} />
        {errors.reason && (
          <p className="text-sm text-destructive">{errors.reason.message}</p>
        )}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending || !records.length}>
        {pending ? "Submitting…" : "Request correction"}
      </Button>
    </form>
  );
}
