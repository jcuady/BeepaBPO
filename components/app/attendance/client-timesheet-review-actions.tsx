"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewClientTimesheet } from "@/lib/attendance/client-timesheet";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function ClientTimesheetReviewActions({
  attendanceRecordId,
}: {
  attendanceRecordId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const result = await reviewClientTimesheet({
        attendance_record_id: attendanceRecordId,
        action,
      });
      if (result.ok) {
        toast.success(result.message);
        setAction(null);
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-9"
          disabled={pending}
          onClick={() => setAction("approve")}
        >
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-9"
          disabled={pending}
          onClick={() => setAction("reject")}
        >
          Send back
        </Button>
      </div>
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={
          action === "reject"
            ? "Send timesheet back to Beepa?"
            : "Approve this timesheet day?"
        }
        description={
          action === "reject"
            ? "Beepa supervisors will revise hours before resubmitting."
            : "This finalizes the day for billing and payroll handoff."
        }
        confirmLabel={action === "reject" ? "Send back" : "Approve"}
        destructive={action === "reject"}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
