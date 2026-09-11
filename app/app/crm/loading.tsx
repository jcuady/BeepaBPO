export default function Loading() {
  return (
    <div className="space-y-4 p-6 md:p-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-md bg-mist" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-mist" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-mist" />
    </div>
  );
}
