import { cn } from "@/lib/utils";

/** Logo-derived interlocking mark geometry. Brand Graphic Language only. */
export function ConnectedGrowthDecoration({
  className,
  opacity = 0.08,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 120"
      className={cn("pointer-events-none", className)}
      fill="none"
    >
      <path
        d="M28 78V42c0-8 6-14 14-14h36"
        stroke="#119446"
        strokeWidth="10"
        strokeLinecap="round"
        opacity={opacity}
      />
      <path
        d="M92 42v36c0 8-6 14-14 14H42"
        stroke="#93C63D"
        strokeWidth="10"
        strokeLinecap="round"
        opacity={opacity}
      />
    </svg>
  );
}

export function LimeArc({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className={cn("pointer-events-none", className)}
      fill="none"
    >
      <path
        d="M20 180C20 90 90 20 180 20"
        stroke="#93C63D"
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}
