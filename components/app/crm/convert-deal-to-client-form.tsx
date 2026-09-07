"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { convertWonDealToClient } from "@/lib/crm/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConvertDealToClientForm({
  dealId,
  defaultName,
}: {
  dealId: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await convertWonDealToClient({
        deal_id: dealId,
        organization_name: name.trim() || undefined,
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Unable to convert deal.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        className="min-h-11"
        onClick={() => setOpen(true)}
      >
        Create client organization
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Create client organization"
        description="Creates an active client org, default portal settings, and links this won deal. Invite users afterward from Clients."
        confirmLabel="Create client"
        pending={pending}
        onConfirm={onConfirm}
      >
        <div className="space-y-2 py-2">
          <Label htmlFor="organization_name">Organization name</Label>
          <Input
            id="organization_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
