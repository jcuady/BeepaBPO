import * as React from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * The one way to render a `<select>` in this app.
 *
 * Why a styled native element rather than the shadcn `Select`:
 *
 *   Every dropdown here is registered with react-hook-form, which needs native
 *   form semantics and a real form value. More importantly, this is a BPO app
 *   used mostly on phones, and `<select>` opens the platform picker — the
 *   wheel on iOS, the sheet on Android. A custom listbox would be visually
 *   identical on desktop and materially worse on the device most of the
 *   workforce actually uses.
 *
 *   So the element stays native and the *styling* is standardised, which was
 *   the actual inconsistency: 26 dropdowns across 22 files had drifted to
 *   `rounded-[10px]` or `rounded-[12px]` against Input's 16px, used
 *   `bg-mist/50` or `bg-white` at random, and — the part that mattered — **none
 *   of them had a focus ring at all**. Keyboard users could not see where they
 *   were in a form full of dropdowns.
 *
 * These classes deliberately mirror `components/ui/input.tsx`: same radius,
 * same border, same focus treatment, same coarse-pointer height. If you change
 * one, change both.
 */
export const nativeSelectClassName = [
  // Geometry and colour match `Input` exactly — including the coarse-pointer
  // floor, which was missing: these were 32px on phones while every other
  // control in a form was 44px.
  "h-8 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-1",
  "[@media(pointer:coarse)]:h-11",
  // 16px on phones so the option text is readable without zooming; desktop
  // keeps the dense 14px. Mirrors Input's `text-base ... md:text-sm`.
  "text-base text-navy md:text-sm",
  "transition-colors outline-none",
  // The focus ring every other control already had.
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  // Native arrow removed so desktop matches the rest of the design; the
  // platform picker still opens on tap.
  "appearance-none pr-9",
  "[&>option]:text-navy",
].join(" ");

function Chevron() {
  return (
    <IconChevronDown
      aria-hidden
      stroke={1.75}
      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate"
    />
  );
}

/**
 * A labelled dropdown. Renders the label, associates it with the control, and
 * places the chevron — so call sites stop re-deriving all three.
 */
export function NativeSelect({
  label,
  id,
  className,
  containerClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & {
  label?: React.ReactNode;
  /** Extra classes for the label wrapper, not the control. */
  containerClassName?: string;
}) {
  const control = (
    <div className="relative">
      <select
        id={id}
        data-slot="native-select"
        className={cn(nativeSelectClassName, className)}
        {...props}
      >
        {children}
      </select>
      <Chevron />
    </div>
  );

  if (!label) return control;

  return (
    <div className={cn("space-y-2", containerClassName)}>
      {typeof label === "string" ? (
        <label
          htmlFor={id}
          className="text-sm font-medium text-navy"
        >
          {label}
        </label>
      ) : (
        label
      )}
      {control}
    </div>
  );
}

/**
 * Compact variant for filter bars, where the control sits inside a denser row
 * and the label sits above it at caption size.
 */
export function NativeSelectCompact({
  label,
  id,
  className,
  ...props
}: React.ComponentProps<"select"> & { label?: React.ReactNode }) {
  return (
    <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate">
      {label ? <span>{label}</span> : null}
      <div className="relative">
        <select
          id={id}
          data-slot="native-select-compact"
          className={cn(nativeSelectClassName, "bg-mist/50", className)}
          {...props}
        >
          {props.children}
        </select>
        <Chevron />
      </div>
    </label>
  );
}