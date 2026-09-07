"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { runCronDryRun, sendAdminTestPush } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";

export function AdminOpsSmokeActions() {
  const [pending, startTransition] = useTransition();

  function cronDryRun() {
    startTransition(async () => {
      const result = await runCronDryRun();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error ?? "Cron dry-run failed.");
    });
  }

  function testPush() {
    startTransition(async () => {
      const result = await sendAdminTestPush();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error ?? "Test push failed.");
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="secondary"
        className="min-h-11"
        disabled={pending}
        onClick={cronDryRun}
      >
        {pending ? "Running…" : "Cron dry-run"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={pending}
        onClick={testPush}
      >
        Send me test push
      </Button>
    </div>
  );
}
