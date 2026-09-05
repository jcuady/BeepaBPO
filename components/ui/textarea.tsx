import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full rounded-[8px] border border-line bg-white px-3.5 py-3 text-base text-ink transition-colors outline-none placeholder:text-slate focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green/30 disabled:cursor-not-allowed disabled:bg-mist disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
