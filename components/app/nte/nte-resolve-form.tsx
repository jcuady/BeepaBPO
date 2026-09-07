"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveNteCase } from "@/lib/hr/nte-actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const RESOLUTION_TYPES = [
  { value: "cleared", label: "Cleared / no action" },
  { value: "verbal_warning", label: "Verbal warning" },
  { value: "written_warning", label: "Written warning" },
  { value: "suspension", label: "Suspension" },
  { value: "dismissal", label: "Dismissal" },
  { value: "other", label: "Other" },
] as const;

type ResolutionType = (typeof RESOLUTION_TYPES)[number]["value"];

export function NteResolveForm({
  nteCaseId,
  caseNumber,
}: {
  nteCaseId: string;
  caseNumber: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resolutionType, setResolutionType] =
    useState<ResolutionType>("cleared");
  const [notes, setNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  function openConfirm() {
    if (notes.trim().length < 5) {
      toast.error("Add resolution notes (at least 5 characters).");
      return;
    }
    setConfirmOpen(true);
  }

  function confirm() {
    startTransition(async () => {
      const result = await resolveNteCase({
        nte_case_id: nteCaseId,
        resolution_type: resolutionType,
        resolution_notes: notes.trim(),
        effective_date:
          resolutionType === "cleared" ? undefined : effectiveDate,
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirmOpen(false);
        setNotes("");
      } else {
        toast.error(result.error ?? "Unable to resolve case.");
      }
    });
  }

  const destructive =
    resolutionType === "suspension" || resolutionType === "dismissal";

  return (
    <div className="space-y-3 rounded-[12px] border border-line bg-mist/40 p-4">
      <p className="text-sm font-medium text-navy">Resolve case</p>
      <div className="space-y-2">
        <Label htmlFor={`nte-resolution-${nteCaseId}`}>Resolution</Label>
        <select
          id={`nte-resolution-${nteCaseId}`}
          className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
          value={resolutionType}
          disabled={pending}
          onChange={(e) =>
            setResolutionType(e.target.value as ResolutionType)
          }
        >
          {RESOLUTION_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {resolutionType !== "cleared" ? (
        <div className="space-y-2">
          <Label htmlFor={`nte-effective-${nteCaseId}`}>Effective date</Label>
          <Input
            id={`nte-effective-${nteCaseId}`}
            type="date"
            className="min-h-11"
            value={effectiveDate}
            disabled={pending}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`nte-notes-${nteCaseId}`}>Resolution notes</Label>
        <Textarea
          id={`nte-notes-${nteCaseId}`}
          rows={3}
          value={notes}
          disabled={pending}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Summary of decision and next steps…"
        />
      </div>
      <Button
        type="button"
        className="min-h-11"
        disabled={pending}
        onClick={openConfirm}
      >
        Resolve NTE
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Resolve ${caseNumber}?`}
        description={`Mark this case resolved as “${resolutionType.replace(/_/g, " ")}”. This cannot be undone from the UI.`}
        confirmLabel="Resolve case"
        destructive={destructive}
        pending={pending}
        onConfirm={confirm}
      />
    </div>
  );
}
