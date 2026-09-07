import type { TablerIcon } from "@tabler/icons-react";
import { IconInbox } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: TablerIcon;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon = IconInbox,
  actionLabel,
  actionHref,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[16px] border border-dashed border-line bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-mist text-slate">
        <Icon stroke={1.75} className="size-6" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-navy">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate">{description}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <Button
          className="mt-4 min-h-11"
          nativeButton={false}
          render={<a href={actionHref} />}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
