import { IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FilterBarProps = {
  placeholder?: string;
  defaultValue?: string;
  name?: string;
  className?: string;
  children?: React.ReactNode;
  /** When false, omit the Apply button (Enter still submits). Default true. */
  showApply?: boolean;
  /** When false, omit the search input (status-only filters). Default true. */
  showSearch?: boolean;
};

/** GET form chrome for list pages. Wrap usage in <form method="get">. */
export function FilterBar({
  placeholder = "Search…",
  defaultValue,
  name = "q",
  className,
  children,
  showApply = true,
  showSearch = true,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[16px] border border-line bg-white p-3 shadow-sm sm:flex-row sm:items-center",
        className,
      )}
    >
      {showSearch ? (
        <div className="relative min-w-0 flex-1">
          <IconSearch
            stroke={1.75}
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate"
            aria-hidden
          />
          <Input
            name={name}
            defaultValue={defaultValue}
            placeholder={placeholder}
            aria-label={placeholder}
            className="min-h-11 border-line bg-mist/50 pl-9"
          />
        </div>
      ) : null}
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
      {showApply ? (
        <Button type="submit" variant="secondary" className="min-h-11 shrink-0">
          Apply
        </Button>
      ) : null}
    </div>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="min-h-11 rounded-[12px] border border-line bg-mist/50 px-3 text-sm text-navy"
      >
        {options.map((opt) => (
          <option key={opt.value || "all"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
