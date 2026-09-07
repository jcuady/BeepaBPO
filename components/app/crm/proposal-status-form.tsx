"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCrmProposalStatus } from "@/lib/crm/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Label } from "@/components/ui/label";

const NEXT: Record<string, { value: string; label: string }[]> = {
  draft: [
    { value: "sent", label: "Mark sent" },
    { value: "withdrawn", label: "Withdraw" },
  ],
  sent: [
    { value: "accepted", label: "Accept" },
    { value: "rejected", label: "Reject" },
    { value: "withdrawn", label: "Withdraw" },
  ],
};

export function ProposalStatusForm({
  proposalId,
  currentStatus,
}: {
  proposalId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState(currentStatus);
  const selectRef = useRef<HTMLSelectElement>(null);
  const options = NEXT[currentStatus] ?? [];

  if (!options.length) return null;

  function handleChange(status: string) {
    if (!status || status === currentStatus) return;
    setNextStatus(status);
    setConfirmOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setConfirmOpen(open);
    if (!open && selectRef.current) {
      selectRef.current.value = "";
      setNextStatus(currentStatus);
    }
  }

  function confirm() {
    startTransition(async () => {
      const result = await updateCrmProposalStatus({
        proposal_id: proposalId,
        status: nextStatus as "sent" | "accepted" | "rejected" | "withdrawn",
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Unable to update proposal.");
        if (selectRef.current) selectRef.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`proposal-status-${proposalId}`}>Update status</Label>
      <select
        ref={selectRef}
        id={`proposal-status-${proposalId}`}
        className="flex min-h-11 w-full max-w-xs rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
        defaultValue=""
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Choose…</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        title="Update proposal status?"
        description={`Mark this proposal as “${nextStatus}”.`}
        confirmLabel="Update"
        pending={pending}
        destructive={nextStatus === "rejected" || nextStatus === "withdrawn"}
        onConfirm={confirm}
      />
    </div>
  );
}
