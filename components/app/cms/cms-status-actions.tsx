"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setCmsContentStatus } from "@/lib/cms/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";

type Entity =
  | "blog_post"
  | "service"
  | "faq"
  | "industry"
  | "testimonial"
  | "case_study";

export function CmsStatusActions({
  id,
  entity,
  status,
}: {
  id: string;
  entity: Entity;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"published" | "archived" | null>(
    null,
  );

  function run() {
    if (!confirm) return;
    startTransition(async () => {
      const result = await setCmsContentStatus({
        id,
        entity,
        status: confirm,
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirm(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Unable to update status.");
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
            onClick={() => setConfirm("published")}
          >
            Publish
          </Button>
        ) : null}
        {status !== "archived" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9"
            disabled={pending}
            onClick={() => setConfirm("archived")}
          >
            Archive
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm === "archived"
            ? "Archive this content?"
            : "Publish this content?"
        }
        description={
          confirm === "archived"
            ? "It will leave the public marketing site. You can publish again later."
            : "It will appear on the public marketing site."
        }
        confirmLabel={confirm === "archived" ? "Archive" : "Publish"}
        destructive={confirm === "archived"}
        pending={pending}
        onConfirm={run}
      />
    </>
  );
}
