import { cn } from "@/lib/utils";

/** Max 3 eyebrows on the homepage. Use only for hero, platform, careers. */
export function SectionEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong",
        className,
      )}
    >
      {children}
    </p>
  );
}
