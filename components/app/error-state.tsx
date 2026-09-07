import { IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this section. Please try again.",
  retryLabel = "Try again",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[16px] border border-line bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <IconAlertTriangle stroke={1.75} className="size-6" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-navy">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate">{description}</p>
      {onRetry ? (
        <Button className="mt-4 min-h-11" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
