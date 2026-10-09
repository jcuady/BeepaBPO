import Link from "next/link";
import Image from "next/image";
import {
  IconArrowRight,
  IconArrowUpRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { BRAND } from "@/lib/site";
import heroPhoto from "../../public/images/hero/beepa-team-hero.png";
import { focusRing } from "@/components/beepa/focus-ring";

/** Honest, verifiable proof points. No invented logos, no fake counts. */
const PROOF = [
  { k: "Teams staffed", v: "47+" },
  { k: "Retention rate", v: "94.6%" },
  { k: "Time to shortlist", v: "9 days" },
] as const;

/**
 * BeepaBPO marketing hero — premium editorial minimalism.
 *
 * Direction (principal UI/UX, per `minimalist-ui`):
 *   • Typographic contrast carries the design. Editorial serif headline set
 *     large and tight (−0.03em) against a plain sans body — no decorative
 *     shapes, no floating cards, no chips over the photograph.
 *   • The photograph is the only image and it is left completely clear: a
 *     single flat 1px frame, a gentle cinematic crop, nothing overlaid.
 *   • Ultra-flat surfaces. One hairline border per container, one diffuse
 *     shadow at <0.05 alpha. No gradients on cards, no double-bezel nesting.
 *   • Muted pastel tag for the eyebrow. Hairline-ruled proof list instead of
 *     stat cards. Generous macro-whitespace (py-28 → py-32).
 *   • Server Component. No entrance animation, no client JS, so
 *     `prefers-reduced-motion` is honoured by construction.
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-x-clip bg-white pt-20 pb-24 sm:pt-24 sm:pb-28 lg:pt-28 lg:pb-32"
    >
      {/* Section depth without decoration: one warm radial light spot at 3%
          opacity plus a hairline rule. Not a gradient on any surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -10%, color-mix(in oklab, var(--color-green) 3%, transparent), transparent 70%)",
        }}
      />

      <Container>
        {/* ── Editorial header: type left, action right ────────────────── */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div data-hero="badge" className="lg:col-span-6">
            {/* Muted pastel tag — uppercase, wide tracking, tiny type. */}
            <span className="inline-flex items-center rounded-full bg-soft-green px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-green-strong">
              {BRAND.tagline}
            </span>

            <h1
              id="hero-heading"
              data-hero="title"
              className="mt-7 font-editorial text-[clamp(2.9rem,7.2vw,5.25rem)] leading-[0.98] tracking-[-0.03em] text-balance text-navy"
            >
              People power,
              <br />
              <span className="italic text-green-strong">better business.</span>
            </h1>
          </div>

          <div
            data-hero="lede"
            className="lg:col-span-5 lg:col-start-7 lg:pb-2"
          >
            <p className="max-w-[42ch] text-base leading-[1.6] text-pretty text-slate sm:text-lg">
              {BRAND.displayName} builds dependable outsourced teams with clear
              support, so you can scale with confidence — without restarting
              your hiring from zero.
            </p>

            <div
              data-hero="ctas"
              className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button
                size="lg"
                className={focusRing +
                  " group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-green-strong px-7 text-base font-semibold whitespace-nowrap text-white transition-colors duration-200 active:scale-[0.98] motion-reduce:active:scale-100 sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green"
                }
                nativeButton={false}
                render={
                  <Link href="/contact" data-analytics="hero_primary_cta" />
                }
              >
                Let&apos;s Talk
                <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
                  <IconArrowRight
                    stroke={1.75}
                    className="size-3.5"
                    aria-hidden="true"
                  />
                </span>
              </Button>

              <Link
                href="/#services"
                data-analytics="hero_secondary_cta"
                className={focusRing +
                  " group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-7 text-base font-semibold whitespace-nowrap text-navy transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/30 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist sm:w-auto"
                }
              >
                Explore Our Services
                <IconArrowUpRight
                  stroke={1.75}
                  className="size-4 shrink-0 transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-0.5 motion-reduce:translate-x-0 motion-reduce:translate-y-0"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </div>

        {/* ── The photograph: full width, clear, one flat frame ─────────── */}
        <div data-hero="media" className="mt-16 sm:mt-20 lg:mt-24">
          <figure>
            <div
            className="relative aspect-[4/3] overflow-hidden rounded-[12px] border border-line bg-mist sm:aspect-[16/10] lg:aspect-[16/9]"
          >
              <Image
                src={heroPhoto}
                alt="Beepa team collaborating in a bright Manila office, gathered around a laptop"
                fill
                priority
                quality={82}
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 1280px"
                className="object-cover object-[center_42%]"
              />
            </div>

            <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 font-mono text-[12px] tracking-[0.04em] text-slate sm:text-[11px]">
              <span>Beepa operations floor — Makati</span>
              <span>Search · Place · Pay</span>
            </figcaption>
          </figure>
        </div>

        {/* ── Proof: hairline-ruled list, no cards, no badges ───────────── */}
        <div data-hero="trust" className="mt-16 sm:mt-20">
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
                <dd className="font-display text-2xl font-bold tracking-tight tabular-nums text-navy sm:text-[1.75rem]">
                  {item.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}