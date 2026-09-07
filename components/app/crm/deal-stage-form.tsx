"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCrmDealStage } from "@/lib/crm/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const STAGES = [
  "new_lead",
  "contacted",
  "qualified",
  "discovery",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "on_hold",
  "follow_up_later",
] as const;

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ");
}

export function DealStageForm({
  dealId,
  currentStage,
}: {
  dealId: string;
  currentStage: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextStage, setNextStage] = useState(currentStage);
  const [lostReason, setLostReason] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);

  function handleChange(stage: string) {
    if (stage === currentStage) return;
    setNextStage(stage);
    setConfirmOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setConfirmOpen(open);
    if (!open && selectRef.current) {
      selectRef.current.value = currentStage;
      setNextStage(currentStage);
      setLostReason("");
    }
  }

  function confirm() {
    startTransition(async () => {
      const result = await updateCrmDealStage({
        deal_id: dealId,
        stage: nextStage as (typeof STAGES)[number],
        lost_reason: nextStage === "lost" ? lostReason : undefined,
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirmOpen(false);
        setLostReason("");
      } else {
        toast.error(result.error ?? "Something went wrong.");
        if (selectRef.current) selectRef.current.value = currentStage;
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`deal-stage-${dealId}`}>Update stage</Label>
      <select
        ref={selectRef}
        id={`deal-stage-${dealId}`}
        className="flex min-h-11 w-full max-w-xs rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
        defaultValue={currentStage}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {stageLabel(stage)}
          </option>
        ))}
      </select>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        title="Update deal stage?"
        description={`Move this deal to “${stageLabel(nextStage)}”.`}
        confirmLabel="Update stage"
        pending={pending}
        destructive={nextStage === "lost"}
        onConfirm={confirm}
      >
        {nextStage === "lost" ? (
          <div className="space-y-2 pt-2">
            <Label htmlFor="deal-lost-reason">Lost reason</Label>
            <Input
              id="deal-lost-reason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Why was this deal lost?"
              className="min-h-11"
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
