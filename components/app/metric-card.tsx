import type { TablerIcon } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  delta?: string;
  deltaPositive?: boolean;
  icon: TablerIcon;
  className?: string;
};

export function MetricCard({
  title,
  value,
  subtitle,
  delta,
  deltaPositive = true,
  icon: Icon,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "",
        className,
      )}
    >
      <CardContent className="flex gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft-green text-green">
          <Icon stroke={1.75} className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate">{title}</p>
          <p className="font-display text-xl font-bold text-navy">{value}</p>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate">{subtitle}</p>
          ) : null}
          {delta ? (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                deltaPositive ? "text-green-strong" : "text-destructive",
              )}
            >
              {delta}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
