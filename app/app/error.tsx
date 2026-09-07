"use client";

import { ErrorState } from "@/components/app/error-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <ErrorState
        title="This page failed to load"
        description={error.message || "Please try again."}
        onRetry={reset}
      />
    </div>
  );
}
