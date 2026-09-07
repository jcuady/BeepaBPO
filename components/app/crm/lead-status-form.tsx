"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCrmLeadStatus } from "@/lib/crm/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Label } from "@/components/ui/label";

const STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
  "lost",
] as const;

export function LeadStatusForm({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState(currentStatus);
  const selectRef = useRef<HTMLSelectElement>(null);

  function handleChange(status: string) {
    if (status === currentStatus) return;
    setNextStatus(status);
    setConfirmOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setConfirmOpen(open);
    if (!open && selectRef.current) {
      selectRef.current.value = currentStatus;
      setNextStatus(currentStatus);
    }
  }

  function confirm() {
    startTransition(async () => {
      const result = await updateCrmLeadStatus({
        lead_id: leadId,
        status: nextStatus as (typeof STATUSES)[number],
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirmOpen(false);
      } else {
        toast.error(result.error ?? "Something went wrong.");
        if (selectRef.current) selectRef.current.value = currentStatus;
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`lead-status-${leadId}`}>Update status</Label>
      <select
        ref={selectRef}
        id={`lead-status-${leadId}`}
        className="flex min-h-11 w-full max-w-xs rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
        defaultValue={currentStatus}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        title="Update lead status?"
        description={`Move this lead to “${nextStatus}”.`}
        confirmLabel="Update status"
        pending={pending}
        destructive={nextStatus === "unqualified" || nextStatus === "lost"}
        onConfirm={confirm}
      />
    </div>
  );
}
