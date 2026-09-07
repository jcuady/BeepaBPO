"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewCashAdvance } from "@/lib/cash-advance/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function CashAdvanceReviewButtons({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const result = await reviewCashAdvance(requestId, action);
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
          disabled={pending}
          onClick={() => setAction("approve")}
        >
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
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
            ? "Reject cash advance?"
            : "Approve cash advance?"
        }
        description={
          action === "reject"
            ? "This request will be marked rejected."
            : "This advances the request through the review workflow."
        }
        confirmLabel={action === "reject" ? "Reject" : "Approve"}
        destructive={action === "reject"}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
