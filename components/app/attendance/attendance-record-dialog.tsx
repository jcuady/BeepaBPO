"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { attendanceRecordUpsertSchema } from "@/lib/validation/app";
import {
  deleteAttendanceRecord,
  upsertAttendanceRecord,
} from "@/lib/attendance/manage";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { z } from "zod";

type FormInput = z.infer<typeof attendanceRecordUpsertSchema>;

const STATUSES = [
  "present",
  "late",
  "absent",
  "leave",
  "rest_day",
  "holiday",
  "incomplete",
] as const;

const selectClass =
  "flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy";

export type AttendanceDialogEmployee = {
  id: string;
  name: string;
};

export type AttendanceDialogRecord = {
  id: string;
  status: (typeof STATUSES)[number];
  clock_in: string;
  clock_out: string;
  approval_status: string;
};

export function AttendanceRecordDialog({
  open,
  onOpenChange,
  employee,
  employees,
  workDate,
  dateLabel,
  record,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: AttendanceDialogEmployee;
  employees: AttendanceDialogEmployee[];
  workDate: string;
  dateLabel: string;
  record?: AttendanceDialogRecord;
  canManage: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[80] sm:max-w-md" showCloseButton>
        {open ? (
          <AttendanceRecordForm
            key={`${record?.id ?? "new"}:${employee?.id ?? "pick"}:${workDate}`}
            employee={employee}
            employees={employees}
            workDate={workDate}
            dateLabel={dateLabel}
            record={record}
            canManage={canManage}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AttendanceRecordForm({
  employee,
  employees,
  workDate,
  dateLabel,
  record,
  canManage,
  onDone,
}: {
  employee?: AttendanceDialogEmployee;
  employees: AttendanceDialogEmployee[];
  workDate: string;
  dateLabel: string;
  record?: AttendanceDialogRecord;
  canManage: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const locked = !canManage || record?.approval_status === "finalized";
  const pickEmployee = !employee;
  const form = useForm<FormInput>({
    resolver: zodResolver(attendanceRecordUpsertSchema),
    defaultValues: {
      id: record?.id ?? "",
      employee_id: employee?.id ?? "",
      work_date: workDate,
      status: record?.status ?? "present",
      clock_in: record?.clock_in ?? "",
      clock_out: record?.clock_out ?? "",
    },
  });

  async function onSubmit(values: FormInput) {
    if (locked) return;
    setPending(true);
    const result = await upsertAttendanceRecord(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Attendance saved.");
      onDone();
      router.refresh();
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to save attendance.");
    }
  }

  async function onDelete() {
    if (!record?.id || locked) return;
    setPending(true);
    const result = await deleteAttendanceRecord({ id: record.id });
    setPending(false);
    setConfirmDelete(false);
    if (result.ok) {
      toast.success(result.message ?? "Attendance record deleted.");
      onDone();
      router.refresh();
    } else {
      toast.error(result.error ?? "Unable to delete attendance.");
    }
  }

  const errors = form.formState.errors;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-navy">
          {record ? "Edit attendance" : "Add attendance"}
        </DialogTitle>
        <DialogDescription>
          {employee ? `${employee.name} · ${dateLabel}` : dateLabel}
          {record?.approval_status === "finalized"
            ? " · Finalized (read only)"
            : canManage
              ? " · Override clock times and status"
              : " · View only"}
        </DialogDescription>
      </DialogHeader>

      {confirmDelete ? (
        <div className="space-y-4">
          <p className="text-sm text-slate">
            Delete this day from the heatmap? The employee can still clock in
            again.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={pending}
              onClick={onDelete}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("id")} />
          {pickEmployee ? (
            <div className="space-y-2">
              <Label htmlFor="attendance-employee">Employee</Label>
              <select
                id="attendance-employee"
                className={selectClass}
                disabled={locked}
                {...form.register("employee_id")}
              >
                <option value="">Select employee…</option>
                {employees.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              {errors.employee_id ? (
                <p className="text-sm text-destructive">
                  {errors.employee_id.message}
                </p>
              ) : null}
            </div>
          ) : (
            <input type="hidden" {...form.register("employee_id")} />
          )}
          {pickEmployee ? (
            <div className="space-y-2">
              <Label htmlFor="attendance-work-date">Date</Label>
              <Input
                id="attendance-work-date"
                type="date"
                className="min-h-11"
                disabled={locked}
                {...form.register("work_date")}
              />
            </div>
          ) : (
            <input type="hidden" {...form.register("work_date")} />
          )}
          <div className="space-y-2">
            <Label htmlFor="attendance-status">Status</Label>
            <select
              id="attendance-status"
              className={selectClass}
              disabled={locked}
              {...form.register("status")}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="attendance-clock-in">Clock in</Label>
              <Input
                id="attendance-clock-in"
                type="time"
                className="min-h-11"
                disabled={locked}
                {...form.register("clock_in")}
              />
              {errors.clock_in ? (
                <p className="text-sm text-destructive">
                  {errors.clock_in.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-clock-out">Clock out</Label>
              <Input
                id="attendance-clock-out"
                type="time"
                className="min-h-11"
                disabled={locked}
                {...form.register("clock_out")}
              />
              {errors.clock_out ? (
                <p className="text-sm text-destructive">
                  {errors.clock_out.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {record && canManage && record.approval_status !== "finalized" ? (
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              className="min-h-11"
              disabled={pending || locked}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
