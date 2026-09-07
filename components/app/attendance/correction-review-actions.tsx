"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewAttendanceCorrection } from "@/lib/attendance/corrections";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function CorrectionReviewActions({
  correctionRequestId,
}: {
  correctionRequestId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const result = await reviewAttendanceCorrection({
        correction_request_id: correctionRequestId,
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
          Reject
        </Button>
      </div>
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={
          action === "reject"
            ? "Reject attendance correction?"
            : "Approve attendance correction?"
        }
        description={
          action === "reject"
            ? "The employee request will be marked rejected. Attendance times stay unchanged."
            : "Requested clock times will be applied to the attendance record."
        }
        confirmLabel={action === "reject" ? "Reject" : "Approve"}
        destructive={action === "reject"}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
