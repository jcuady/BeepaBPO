"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateTicketStatus } from "@/lib/tickets/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Label } from "@/components/ui/label";

const STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "waiting_for_client",
  "resolved",
  "closed",
] as const;

export function TicketStatusForm({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
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
      const result = await updateTicketStatus({
        ticket_id: ticketId,
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
      <Label htmlFor={`ticket-status-${ticketId}`}>Update status</Label>
      <select
        ref={selectRef}
        id={`ticket-status-${ticketId}`}
        className="flex min-h-11 w-full max-w-xs rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
        defaultValue={currentStatus}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        title="Update ticket status?"
        description={`Change status to “${nextStatus.replace(/_/g, " ")}”. This is recorded in ticket history.`}
        confirmLabel="Update status"
        pending={pending}
        onConfirm={confirm}
      />
    </div>
  );
}
