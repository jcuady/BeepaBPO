import Image, { type ImageProps } from "next/image";
import type { TablerIcon } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * Landing-page shared primitives for the redesigned marketing surface.
 *
 * All sections on the public landing page should pull from this file so the
 * visual vocabulary stays tight: pill-shaped eyebrows with a green-strong dot,
 * bezel-framed photos with an inset highlight, and the two floating "island"
 * cards (status pill + retention-style metric) that overlay the photo edges.
 *
 * Tokens in use:
 *   • navy `#1f2058` for primary text and the outer bezel ring
 *   • green-strong `#0b6e34` for primary accent + dot
 *   • lime `#93c63D` for highlighter accents only (no body text)
 *   • mist / soft-green for pastel-tinted surfaces
 *
 * No backdrop-blur is allowed anywhere; floating cards rely on solid
 * backgrounds + soft shadows + 1px rings for depth.
 */

/* ──────────────────────────────────────────────────────────────────────────
 *  EyebrowPill — the small-caps section marker. Square, with a short rule.
 *
 *  NAME RETAINED DELIBERATELY. This used to be a bordered pill with a coloured
 *  dot. The new design drops the pill in favour of an 18x2px rule followed by
 *  the label, which is what `.eyebrow` in globals.css already does for the
 *  hero. Renaming it would mean editing every call site in the same commit as
 *  the visual change, which makes the diff harder to read for no benefit; the
 *  component's job has not changed, only its shape.
 *
 *  The dot became a rule rather than vanishing, because it is the one thing
 *  that makes a bare uppercase label read as deliberate rather than as
 *  leftover.
 * ──────────────────────────────────────────────────────────────────────── */
export function EyebrowPill({
  children,
  className,
  tone = "green",
  index,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "green" | "navy";
  /**
   * Two-digit section number, e.g. `"01"`. The reference marks every section
   * `01 / MORE THAN OUTSOURCING` — the number is what makes the page read as a
   * sequence rather than a pile of blocks, and it is the cheapest way to make
   * scroll position legible to a reader.
   *
   * Optional because two surfaces use this component for a label that is not a
   * numbered section (the Careers band, for instance).
   */
  index?: string;
}) {
  const labelTone = tone === "navy" ? "text-navy" : "text-green-strong";
  const ruleTone = tone === "navy" ? "bg-navy" : "bg-green-strong";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-display text-[11px] font-semibold tracking-[0.16em] uppercase",
        labelTone,
        className,
      )}
    >
      <span aria-hidden className={cn("block h-0.5 w-[18px] shrink-0", ruleTone)} />
      {index ? (
        // The number is presentational — the heading below carries the meaning —
        // so it is hidden from assistive tech rather than read as "zero one".
        <>
          <span aria-hidden className="tabular-nums">
            {index}
          </span>
          <span aria-hidden className="-ml-1 opacity-45">
            /
          </span>
        </>
      ) : null}
      <span>{children}</span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  BezelFrame — Double-Bezel (Doppelrand) photo frame.
 *
 *  Outer shell carries the surface tint + outer ring + ambient shadow;
 *  inner core carries the image with an inset hairline highlight.
 *  Uses an explicit aspect-ratio class so CLS is preserved even when the
 *  image has not yet decoded.
 * ──────────────────────────────────────────────────────────────────────── */
export function BezelFrame({
  src,
  alt,
  sizes,
  quality = 82,
  priority = false,
  /** Aspect class for the inner core (e.g. "aspect-[16/9]", "aspect-[4/3]"). */
  aspectClassName = "aspect-[16/9]",
  /** Object-position class for the inner <Image>. */
  objectClassName = "object-cover object-center",
  /** Extra classes appended to the inner core. */
  coreClassName,
  /** Override the outer ring color (default: navy/8 hairline). */
  outerClassName,
  /** Extra props spread onto the inner <Image> (e.g. data-* attributes). */
  imageProps,
}: {
  src: ImageProps["src"];
  alt: string;
  sizes: string;
  quality?: number;
  priority?: boolean;
  aspectClassName?: string;
  objectClassName?: string;
  coreClassName?: string;
  outerClassName?: string;
  imageProps?: Omit<ImageProps, "src" | "alt" | "fill" | "quality" | "priority" | "sizes" | "className">;
}) {
  return (
    <div
      className={cn(
        "relative rounded-none bg-mist p-2 ring-1 ring-line shadow-panel",
        outerClassName,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-none bg-white/60 ring-1 ring-white/70",
          aspectClassName,
          coreClassName,
        )}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          quality={quality}
          sizes={sizes}
          className={objectClassName}
          {...imageProps}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  StatusPill — small floating pill that anchors the top-right corner
 *  of a bezel-framed photo. Optional leading icon disc + trailing icon.
 * ──────────────────────────────────────────────────────────────────────── */
export function StatusPill({
  icon: Icon,
  children,
  trailingIcon: TrailingIcon,
  className,
}: {
  icon?: TablerIcon;
  children: React.ReactNode;
  trailingIcon?: TablerIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hidden items-center gap-2 rounded-none bg-navy px-3 py-2 font-display text-[11px] font-semibold tracking-[0.08em] text-white shadow-panel md:flex",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className="flex size-5 items-center justify-center rounded-none bg-white/15 text-white"
        >
          <Icon stroke={1.5} className="size-3" />
        </span>
      ) : null}
      <span className="font-display text-xs font-semibold tracking-tight text-white">
        {children}
      </span>
      {TrailingIcon ? (
        <TrailingIcon
          stroke={1.5}
          className="size-3.5 text-white/70"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  MetricCard — floating metric card overlapping the bottom-left of the
 *  photo. Composition: tiny disc icon + label, big tabular-num value,
 *  optional delta chip, footnote line.
 * ──────────────────────────────────────────────────────────────────────── */
export function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  footnote,
  className,
}: {
  icon: TablerIcon;
  label: string;
  value: string;
  delta?: string;
  footnote: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hidden w-[15.5rem] rounded-none bg-white p-4 ring-1 ring-line shadow-raised md:block",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-none bg-soft-green text-green-strong ring-1 ring-green-strong/15"
        >
          <Icon stroke={1.5} className="size-4" />
        </span>
        <span className="font-display text-xs font-semibold tracking-tight text-navy">
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tracking-tight tabular-nums text-navy">
          {value}
        </span>
        {delta ? (
          <span className="font-display text-[11px] font-semibold tracking-tight text-green-strong">
            {delta}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 font-display text-[11px] leading-snug text-slate">
        {footnote}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  SectionShell — ambient backdrop for sections with the new vibe.
 *  Three pointer-events-none layers: top mist gradient, optional top-right
 *  soft-green radial orb, optional bottom-left mist radial orb. No blur.
 * ──────────────────────────────────────────────────────────────────────── */
export function SectionBackdrop({
  variant = "mist",
  className,
}: {
  variant?: "mist" | "white" | "navy";
  className?: string;
}) {
  if (variant === "white") return null;
  if (variant === "navy") {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 bg-navy",
        )}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-mist via-mist/60 to-white",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-12%] h-[560px] w-[560px] rounded-full bg-soft-green/55 [mask-image:radial-gradient(closest-side,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 left-[-12%] h-[440px] w-[440px] rounded-full bg-white [mask-image:radial-gradient(closest-side,black,transparent_75%)]"
      />
    </div>
  );
}