"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelLeaveRequest } from "@/lib/leave/actions";
import { Button } from "@/components/ui/button";

export function CancelLeaveButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-9"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelLeaveRequest(requestId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error ?? "Something went wrong.");
        })
      }
    >
      Cancel
    </Button>
  );
}
