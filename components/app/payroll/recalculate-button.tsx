"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recalculatePayrollRecord } from "@/lib/payroll/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function RecalculatePayrollButton({
  payrollRecordId,
}: {
  payrollRecordId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function confirm() {
    startTransition(async () => {
      const result = await recalculatePayrollRecord(payrollRecordId);
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
        size="sm"
        variant="secondary"
        className="min-h-11"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Recalculate
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Recalculate this payroll record?"
        description="Totals will be recomputed from current attendance and payroll rules. Review figures before sending for approval."
        confirmLabel="Recalculate"
        cancelLabel="Keep as-is"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
