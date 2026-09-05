import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[8px] border border-line bg-white px-3.5 py-2 text-base text-ink transition-colors outline-none placeholder:text-slate file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green/30 disabled:cursor-not-allowed disabled:bg-mist disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
