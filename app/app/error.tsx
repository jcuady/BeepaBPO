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
    // Same machine-readable marker as `forbidden.tsx`. An error boundary renders
    // at the requested URL too, so without this an auditor scores a crashed page
    // as a clean one.
    <div className="mx-auto max-w-3xl py-10" data-page-status="error">
      <ErrorState
        title="This page failed to load"
        description={error.message || "Please try again."}
        onRetry={reset}
      />
    </div>
  );
}
