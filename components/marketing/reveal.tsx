import { cn } from "@/lib/utils";

/** Layout wrapper only. Entrance fade was removed so copy is visible on first paint. */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={cn(className)}>{children}</div>;
}
