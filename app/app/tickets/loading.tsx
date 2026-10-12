export default function Loading() {
  return (
    <div
      className="space-y-4 p-6 md:p-8"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-8 w-40 animate-pulse rounded-none bg-mist" />
      <div className="h-12 animate-pulse rounded-none bg-mist" />
      <div className="h-80 animate-pulse rounded-none bg-mist" />
    </div>
  );
}
