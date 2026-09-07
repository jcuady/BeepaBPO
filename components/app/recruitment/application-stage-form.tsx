"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateApplicationStage } from "@/lib/recruitment/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Label } from "@/components/ui/label";

const STAGES = [
  "applied",
  "screening",
  "initial_interview",
  "assessment",
  "client_endorsement",
  "client_interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
  "talent_pool",
  "on_hold",
] as const;

export function ApplicationStageForm({
  applicationId,
  currentStage,
}: {
  applicationId: string;
  currentStage: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextStage, setNextStage] = useState(currentStage);
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
    }
  }

  function confirm() {
    startTransition(async () => {
      const result = await updateApplicationStage({
        application_id: applicationId,
        stage: nextStage as (typeof STAGES)[number],
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirmOpen(false);
      } else {
        toast.error(result.error ?? "Something went wrong.");
        if (selectRef.current) selectRef.current.value = currentStage;
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`application-stage-${applicationId}`}>Move stage</Label>
      <select
        ref={selectRef}
        id={`application-stage-${applicationId}`}
        className="flex min-h-11 w-full max-w-xs rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
        defaultValue={currentStage}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {stage.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        title="Move application stage?"
        description={`Move this candidate to “${nextStage.replace(/_/g, " ")}”.`}
        confirmLabel="Move stage"
        pending={pending}
        destructive={nextStage === "rejected" || nextStage === "withdrawn"}
        onConfirm={confirm}
      />
    </div>
  );
}
