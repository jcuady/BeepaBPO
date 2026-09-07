"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignTicket } from "@/lib/tickets/actions";
import type { TicketAssigneeOption } from "@/lib/tickets/assignees";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Label } from "@/components/ui/label";

export function TicketAssignForm({
  ticketId,
  currentAssigneeId,
  assignees,
}: {
  ticketId: string;
  currentAssigneeId: string | null;
  assignees: TicketAssigneeOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextAssigneeId, setNextAssigneeId] = useState(currentAssigneeId ?? "");
  const selectRef = useRef<HTMLSelectElement>(null);

  function handleChange(value: string) {
    if (value === (currentAssigneeId ?? "")) return;
    setNextAssigneeId(value);
    setConfirmOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setConfirmOpen(open);
    if (!open && selectRef.current) {
      selectRef.current.value = currentAssigneeId ?? "";
      setNextAssigneeId(currentAssigneeId ?? "");
    }
  }

  const nextLabel =
    nextAssigneeId === ""
      ? "Unassigned"
      : (assignees.find((a) => a.id === nextAssigneeId)?.displayName ??
        "Teammate");

  function confirm() {
    startTransition(async () => {
      const result = await assignTicket({
        ticket_id: ticketId,
        assigned_user_id: nextAssigneeId || null,
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirmOpen(false);
      } else {
        toast.error(result.error ?? "Something went wrong.");
        if (selectRef.current) {
          selectRef.current.value = currentAssigneeId ?? "";
        }
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`ticket-assignee-${ticketId}`}>Assignee</Label>
      <select
        ref={selectRef}
        id={`ticket-assignee-${ticketId}`}
        className="flex min-h-11 w-full max-w-xs rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
        defaultValue={currentAssigneeId ?? ""}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Unassigned</option>
        {assignees.map((person) => (
          <option key={person.id} value={person.id}>
            {person.displayName}
          </option>
        ))}
      </select>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        title="Update ticket assignee?"
        description={`Assign this ticket to “${nextLabel}”.`}
        confirmLabel="Save assignee"
        pending={pending}
        onConfirm={confirm}
      />
    </div>
  );
}
