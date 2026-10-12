import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/site";
import { focusRing } from "@/components/beepa/focus-ring";

/**
 * Honest, verifiable proof points. No invented logos, no fake counts.
 * Unchanged from the previous hero — these are approved figures, and the
 * redesign was a design change, not a content one.
 */
const PROOF = [
  { k: "Teams staffed", v: "47+" },
  { k: "Retention rate", v: "94.6%" },
  { k: "Time to shortlist", v: "9 days" },
] as const;

/**
 * BeepaBPO marketing hero — editorial split, per the new landing design.
 *
 * WHAT CHANGED AND WHY
 *   • **Split, not stacked.** The photo was a 16:9 band beneath the copy; it
 *     is now a full-height right column at ≥lg. The reference's strongest move
 *     is that copy and face are read at the same time, and stacking them forces
 *     a scroll between the two.
 *   • **Manrope at weight 500, 67px.** The old hero used the Instrument serif
 *     at weight 700. The reference direction is lighter and larger — editorial
 *     through restraint, not through a second typeface.
 *   • **Square controls.** `rounded-full` pills are gone. The brandbook lists
 *     "huge pills everywhere" under things to avoid, and the reference's
 *     buttons are `rounded-none`.
 *   • **Caption over the photograph.** The scrim exists because the caption
 *     sits on whatever the subject happens to be wearing; without it the same
 *     copy fails contrast on a different photo.
 *
 * WHAT DELIBERATELY DID NOT CHANGE
 *   The CTAs still route to `/contact` and `/#services`. The reference opens a
 *   modal that downloads a draft brief, but that is a new workflow, and this
 *   change is design-only.
 *
 * Server Component, no client JS, so `prefers-reduced-motion` is honoured by
 * construction rather than by a guard.
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate bg-white"
    >
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 lg:grid-cols-2">
        {/* ── Copy column ─────────────────────────────────────────────── */}
        <div className="flex flex-col justify-center px-[clamp(1.25rem,4.5vw,4rem)] pt-12 pb-10 lg:py-20 lg:pr-14">
          <span className="eyebrow">{BRAND.tagline}</span>

          <h1
            id="hero-heading"
            data-hero="title"
            className="mt-8 font-display text-[clamp(2.75rem,6.4vw,4.1875rem)] font-medium leading-[1.075] tracking-[-0.025em] text-balance text-navy"
          >
            People power,
            <br />
            <span className="text-green-strong">better business.</span>
          </h1>

          <p
            data-hero="lede"
            className="mt-7 max-w-[46ch] text-[1.0625rem] leading-[1.6] text-pretty text-slate sm:text-lg"
          >
            {BRAND.displayName} builds dependable outsourced teams with clear
            support, so you can scale with confidence — without restarting your
            hiring from zero.
          </p>

          <div
            data-hero="ctas"
            className="mt-9 flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center"
          >
            <Button
              variant="brand"
              size="cta"
              nativeButton={false}
              render={
                <Link href="/contact" data-analytics="hero_primary_cta" />
              }
            >
              Let&rsquo;s Talk
            </Button>

            <Button
              variant="editorial"
              size="editorial"
              nativeButton={false}
              render={<Link href="/#services" data-analytics="hero_secondary_cta" />}
            >
              Explore Our Services
            </Button>
          </div>

          {/* ── Hero foot: a person, not a stat ─────────────────────────── */}
          <div
            data-hero="foot"
            className="mt-12 flex items-center gap-4 border-t border-line pt-7"
          >
            <Image
              src="/images/hero/testimonial-portrait-256.webp"
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-full object-cover"
            />
            <p className="text-sm leading-[1.5] text-slate">
              <span className="block font-display font-semibold text-navy">
                Real people. Fully in your corner.
              </span>
              Dedicated to your business, not just your tasks.
            </p>
          </div>
        </div>

        {/* ── Photograph column ────────────────────────────────────────── */}
        <div
          data-hero="media"
          className="relative min-h-[380px] overflow-hidden bg-mist sm:min-h-[460px] lg:min-h-full"
        >
          <Image
            src="/images/hero/beepa-team-hero.webp"
            alt="Beepa team collaborating in a bright Manila office, gathered around a laptop"
            fill
            priority
            quality={82}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-[center_42%]"
          />

          {/* Scrim, referenced from the token layer so it is not re-typed. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[image:var(--scrim-photo)]"
          />

          {/* A solid navy chip, not floating white text. The first build of
              this used bare `text-white/85` over the photograph and was
              unreadable against the bright window behind the subject — the
              photo's top half is the brightest part of the frame. The chip
              carries its own background, so the label's contrast does not
              depend on which photograph ships. */}
          <p className="absolute right-6 top-6 z-1 bg-navy px-3 py-2 font-display text-[0.5625rem] font-semibold tracking-[0.14em] text-white uppercase sm:right-8 sm:top-8">
            The people behind your progress
          </p>

          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 px-6 pb-6 sm:px-8 sm:pb-8">
            <p className="font-display text-lg leading-[1.25] text-white">
              <span className="block font-semibold">
                A little closer to your team.
              </span>
              <span className="text-white/80">Even from a world away.</span>
            </p>
            <p className="font-display text-[0.625rem] leading-[1.6] tracking-[0.1em] text-white/70 uppercase">
              Based in the Philippines
              <br />
              Connected to your business
            </p>
          </div>
        </div>
      </div>

      {/* ── Proof: hairline-ruled list, no cards, no badges ───────────── */}
      <div className="mx-auto w-full max-w-[1600px] px-[clamp(1.25rem,4.5vw,4rem)] pb-16 lg:pb-20">
        <dl className="grid grid-cols-1 border-t border-line sm:grid-cols-3">
          {PROOF.map((item, i) => (
            <div
              key={item.k}
              className={
                "flex items-baseline justify-between gap-4 border-b border-line py-5 " +
                "sm:border-b-0 sm:py-6 " +
                (i < PROOF.length - 1 ? "sm:border-r sm:border-line sm:pr-8" : "") +
                (i > 0 ? "sm:pl-8" : "")
              }
            >
              <dt className="font-display text-[13px] font-medium text-slate">
                {item.k}
              </dt>
              <dd className="font-display text-2xl font-semibold tracking-tight tabular-nums text-navy sm:text-[1.75rem]">
                {item.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}