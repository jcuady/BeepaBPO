"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitPayrollPeriodForApproval } from "@/lib/payroll/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function SubmitPayrollApprovalButton({
  payrollPeriodId,
}: {
  payrollPeriodId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function confirm() {
    startTransition(async () => {
      const result = await submitPayrollPeriodForApproval(payrollPeriodId);
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
        className="min-h-11"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Submit for approval
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Submit payroll period for approval?"
        description="Finance reviews first, then Owner finalizes. You cannot edit records while approval is pending."
        confirmLabel="Submit"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
