"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateApplicationStage } from "@/lib/recruitment/actions";
import {
  APPLICATION_STAGES,
  PIPELINE_STAGES,
  stageMeta,
  type ApplicationStage,
} from "@/lib/recruitment/application-stage";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Grouped so a reviewer is not picking from a flat list of twelve identical
 * strings. The grouping encodes the decision: "advance the pipeline", "finish
 * it", or "park it".
 */
const GROUPS: readonly { label: string; stages: readonly ApplicationStage[] }[] = [
  { label: "Pipeline", stages: PIPELINE_STAGES },
  {
    label: "Finished",
    stages: APPLICATION_STAGES.filter((s) => stageMeta(s).tone === "negative"),
  },
  {
    label: "Parked",
    stages: APPLICATION_STAGES.filter((s) => stageMeta(s).tone === "warning"),
  },
];

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
        stage: nextStage as ApplicationStage,
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

  const nextMeta = stageMeta(nextStage);
  const destructive =
    nextMeta.tone === "negative" || nextStage === currentStage;

  return (
    <div className="space-y-2">
      <Label htmlFor={`application-stage-${applicationId}`}>Move stage</Label>
      <NativeSelect
        ref={selectRef}
        id={`application-stage-${applicationId}`}
        // Layout only — the styling comes from the primitive. Restored after the
        // migration stripped it along with the old hand-rolled class string; a
        // full-width dropdown inside a card reads as a bug.
        className="max-w-xs"
        defaultValue={currentStage}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.stages.map((stage) => (
              <option key={stage} value={stage}>
                {stageMeta(stage).label}
              </option>
            ))}
          </optgroup>
        ))}
      </NativeSelect>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        title="Move application stage?"
        // Say what the target stage means, not just its name. A reviewer moving
        // someone to "talent_pool" should be reminded it is not terminal.
        description={`${nextMeta.label} — ${nextMeta.staffNote}`}
        confirmLabel="Move stage"
        pending={pending}
        destructive={destructive}
        onConfirm={confirm}
      />
    </div>
  );
}