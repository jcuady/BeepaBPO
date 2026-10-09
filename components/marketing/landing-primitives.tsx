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
 *  EyebrowPill — replaces bare uppercase text with a bordered pill
 *  matching the hero's design system.
 * ──────────────────────────────────────────────────────────────────────── */
export function EyebrowPill({
  children,
  className,
  tone = "green",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "green" | "navy";
}) {
  const labelTone =
    tone === "navy"
      ? "text-navy"
      : "text-green-strong";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border border-line bg-white/85 py-1.5 pr-6 pl-3 ring-1 ring-line/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(31,32,88,0.04)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-2 rounded-full ring-2",
          tone === "navy"
            ? "bg-navy ring-navy/15"
            : "bg-green-strong ring-green-strong/15",
        )}
      />
      <span
        className={cn(
          "font-display text-[11px] font-semibold uppercase tracking-[0.18em]",
          labelTone,
        )}
      >
        {children}
      </span>
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
        "relative rounded-[2rem] bg-mist p-2 ring-1 ring-line shadow-[0_30px_60px_-32px_rgba(31,32,88,0.22),0_8px_24px_-12px_rgba(11,110,52,0.10)]",
        outerClassName,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.625rem] bg-white/60 ring-1 ring-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
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
        "hidden items-center gap-2 rounded-full bg-white py-1.5 pr-3 pl-2.5 ring-1 ring-line shadow-[0_10px_24px_-12px_rgba(31,32,88,0.22)] md:flex",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className="flex size-5 items-center justify-center rounded-full bg-soft-green text-green-strong"
        >
          <Icon stroke={1.5} className="size-3" />
        </span>
      ) : null}
      <span className="font-display text-xs font-semibold tracking-tight text-navy">
        {children}
      </span>
      {TrailingIcon ? (
        <TrailingIcon
          stroke={1.5}
          className="size-3.5 text-slate"
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
        "hidden w-[15.5rem] rounded-2xl bg-white p-4 ring-1 ring-line shadow-[0_18px_36px_-18px_rgba(31,32,88,0.22)] md:block",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-lg bg-soft-green text-green-strong ring-1 ring-green-strong/15"
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