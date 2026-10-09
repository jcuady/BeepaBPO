import { DashboardSkeleton } from "@/components/app/loading-skeleton";

export default function Loading() {
  return (
    <div
      className="mx-auto max-w-6xl"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <DashboardSkeleton />
    </div>
  );
}
