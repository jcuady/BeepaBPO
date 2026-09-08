"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewPayrollPeriod } from "@/lib/payroll/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function PayrollPeriodReviewButtons({
  payrollPeriodId,
}: {
  payrollPeriodId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const result = await reviewPayrollPeriod({
        payroll_period_id: payrollPeriodId,
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          disabled={pending}
          onClick={() => setAction("approve")}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
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
            ? "Send payroll period back?"
            : "Approve this payroll step?"
        }
        description={
          action === "reject"
            ? "Period returns to review so finance can fix and resubmit."
            : "Advances the seeded Finance → Owner payroll workflow."
        }
        confirmLabel={action === "reject" ? "Send back" : "Approve"}
        destructive={action === "reject"}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
