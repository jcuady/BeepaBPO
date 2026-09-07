import { DashboardSkeleton } from "@/components/app/loading-skeleton";

export default function AppLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <DashboardSkeleton />
    </div>
  );
}
