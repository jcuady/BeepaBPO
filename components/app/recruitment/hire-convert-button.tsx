"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { convertApplicantToEmployee } from "@/lib/recruitment/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function HireConvertButton({
  applicationId,
  applicantName,
  alreadyHired,
}: {
  applicationId: string;
  applicantName: string;
  alreadyHired: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function confirm() {
    startTransition(async () => {
      const result = await convertApplicantToEmployee({
        application_id: applicationId,
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="min-h-9"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {alreadyHired ? "Create employee record" : "Hire & create employee"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Hire ${applicantName}?`}
        description="Creates an employee record, assigns the employee role, sets stage to hired, and invites them to sign in if they do not have an account yet."
        confirmLabel="Hire"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
