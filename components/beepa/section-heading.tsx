import { cn } from "@/lib/utils";

export function SectionHeading({
  as: Tag = "h2",
  children,
  className,
}: {
  as?: "h1" | "h2" | "h3";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "font-display font-bold tracking-tight text-navy text-balance",
        Tag === "h1" && "text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.05]",
        Tag === "h2" && "text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.15]",
        Tag === "h3" && "text-[clamp(1.25rem,2vw,1.5rem)] leading-snug",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
