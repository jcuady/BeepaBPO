export default function Loading() {
  return (
    <div className="space-y-4 p-6 md:p-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-md bg-mist" />
      <div className="h-12 animate-pulse rounded-xl bg-mist" />
      <div className="h-80 animate-pulse rounded-2xl bg-mist" />
    </div>
  );
}
