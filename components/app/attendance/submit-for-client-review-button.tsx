"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { submitTimesheetForClientReview } from "@/lib/attendance/client-timesheet";
import { Button } from "@/components/ui/button";

export function SubmitForClientReviewButton({
  attendanceRecordId,
}: {
  attendanceRecordId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="min-h-9"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await submitTimesheetForClientReview({
            attendance_record_id: attendanceRecordId,
          });
          if (result.ok) {
            toast.success(result.message);
          } else {
            toast.error(result.error ?? "Unable to submit.");
          }
        });
      }}
    >
      {pending ? "Sending…" : "Send to client"}
    </Button>
  );
}
