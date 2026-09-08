"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelLeaveRequest } from "@/lib/leave/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function CancelLeaveButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function confirm() {
    startTransition(async () => {
      const result = await cancelLeaveRequest(requestId);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Cancel
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this leave request?"
        description="This withdraws the request from the approval queue. You can submit a new request later."
        confirmLabel="Cancel leave"
        cancelLabel="Keep request"
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
