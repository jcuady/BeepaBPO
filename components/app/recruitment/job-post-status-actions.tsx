"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { closeJobPost, publishJobPost } from "@/lib/recruitment/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

export function JobPostStatusActions({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"publish" | "close" | null>(null);

  function run() {
    if (!confirm) return;
    startTransition(async () => {
      const result =
        confirm === "close"
          ? await closeJobPost({ id: jobId })
          : await publishJobPost({ id: jobId });
      if (result.ok) {
        toast.success(result.message);
        setConfirm(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Unable to update job.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status !== "published" ? (
          <Button
            type="button"
            size="sm"
            className="min-h-9"
            disabled={pending}
            onClick={() => setConfirm("publish")}
          >
            Publish
          </Button>
        ) : null}
        {status !== "closed" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9"
            disabled={pending}
            onClick={() => setConfirm("close")}
          >
            Close
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm === "close" ? "Close this job post?" : "Publish this job post?"
        }
        description={
          confirm === "close"
            ? "The role will leave the public careers page. Existing applications stay on file."
            : "The role will appear on the public careers page."
        }
        confirmLabel={confirm === "close" ? "Close job" : "Publish"}
        destructive={confirm === "close"}
        pending={pending}
        onConfirm={run}
      />
    </>
  );
}
