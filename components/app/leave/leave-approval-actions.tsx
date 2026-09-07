"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewLeaveRequest } from "@/lib/leave/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function LeaveApprovalActions({
  leaveRequestId,
}: {
  leaveRequestId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const result = await reviewLeaveRequest({
        leave_request_id: leaveRequestId,
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
        title={action === "reject" ? "Reject leave request?" : "Approve leave request?"}
        description={
          action === "reject"
            ? "The employee will be notified that this leave was rejected."
            : "This will approve the leave request and update balances."
        }
        confirmLabel={action === "reject" ? "Reject" : "Approve"}
        destructive={action === "reject"}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
