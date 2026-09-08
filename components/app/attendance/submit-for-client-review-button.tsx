"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitTimesheetForClientReview } from "@/lib/attendance/client-timesheet";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function SubmitForClientReviewButton({
  attendanceRecordId,
}: {
  attendanceRecordId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function confirm() {
    startTransition(async () => {
      const result = await submitTimesheetForClientReview({
        attendance_record_id: attendanceRecordId,
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.error ?? "Unable to submit.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-9"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Send to client
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Send timesheet to the client?"
        description="The client will see this timesheet in their Approvals queue for review."
        confirmLabel="Send to client"
        cancelLabel="Not now"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
