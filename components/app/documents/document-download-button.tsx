"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { getDocumentDownloadUrl } from "@/lib/documents/actions";
import { Button } from "@/components/ui/button";

export function DocumentDownloadButton({
  documentId,
}: {
  documentId: string;
}) {
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const result = await getDocumentDownloadUrl(documentId);
      if (!result.ok || !result.url) {
        toast.error(result.error ?? "Unable to download.");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="min-h-9"
      disabled={pending}
      onClick={download}
    >
      {pending ? "Preparing…" : "Download"}
    </Button>
  );
}
