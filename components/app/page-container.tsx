import { cn } from "@/lib/utils";

const sizes = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
} as const;

export function PageContainer({
  size = "default",
  className,
  children,
}: {
  size?: keyof typeof sizes;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto space-y-6", sizes[size], className)}>
      {children}
    </div>
  );
}
