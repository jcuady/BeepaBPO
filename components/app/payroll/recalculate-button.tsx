"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { recalculatePayrollRecord } from "@/lib/payroll/actions";
import { Button } from "@/components/ui/button";

export function RecalculatePayrollButton({
  payrollRecordId,
}: {
  payrollRecordId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="min-h-11"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await recalculatePayrollRecord(payrollRecordId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error ?? "Something went wrong.");
        });
      }}
    >
      {pending ? "Recalculating…" : "Recalculate"}
    </Button>
  );
}
