import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The auth surface is public-facing brand, so its fields follow the same square
 * language as the marketing CTAs — while the shared `Input` keeps `rounded-lg`
 * for the dense product UI, where corners help separate a wall of controls.
 *
 * `cn` merges rather than appends, so this wins over the primitive's base
 * radius, and any caller-supplied className still wins over this. That ordering
 * matters: it means a one-off override on a single field is still possible
 * without reaching into the primitive.
 */
export function AuthInput({ className, ...props }: React.ComponentProps<"input">) {
  return <Input className={cn("rounded-none", className)} {...props} />;
}