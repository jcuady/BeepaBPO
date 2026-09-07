import Link from "next/link";
import {
  IconArrowRight,
  IconBulb,
  IconChartBar,
  IconUsers,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { LimeArc } from "@/components/beepa/connected-growth-decoration";
import { ResponsiveImageFrame } from "@/components/beepa/responsive-image-frame";
import { SectionEyebrow } from "@/components/beepa/section-eyebrow";

const FEATURES = [
  { label: "Talented People", icon: IconUsers },
  { label: "Proven Processes", icon: IconBulb },
  { label: "Real Business Impact", icon: IconChartBar },
] as const;

export function HeroSection() {
  return (
    <section className="relative overflow-x-hidden pb-14 pt-6 sm:pb-20 sm:pt-8 md:pb-28 md:pt-10">
      {/* Atmospheric wash — soft green mist so the photo has somewhere to dissolve */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_85%_20%,rgb(238_247_232/0.95)_0%,rgb(245_247_246/0.55)_42%,#ffffff_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-8 -z-10 size-[min(52vw,520px)] rounded-full bg-soft-green/70 blur-3xl"
      />

      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-6 xl:gap-10">
          <div className="hero-enter relative z-10 lg:col-span-5">
            <SectionEyebrow>People. Process. Progress.</SectionEyebrow>
            <h1 className="mt-4 font-display text-[clamp(2.35rem,5.2vw,4.15rem)] font-bold leading-[1.02] tracking-tight text-navy text-balance">
              People power{" "}
              <span className="text-green-strong">better business.</span>
            </h1>
            <p className="mt-5 max-w-[40ch] text-base leading-relaxed text-slate sm:mt-6 md:text-lg">
              Dependable teams. Smarter operations. A trusted outsourcing
              partner helping you scale with confidence.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                size="lg"
                className="min-h-11 w-full px-5 active:scale-[0.98] sm:w-auto"
                nativeButton={false}
                render={
                  <Link href="/contact" data-analytics="hero_primary_cta" />
                }
              >
                Let&apos;s Talk
                <IconArrowRight stroke={2} className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="min-h-11 w-full px-5 active:scale-[0.98] sm:w-auto"
                nativeButton={false}
                render={
                  <Link
                    href="/#services"
                    data-analytics="hero_secondary_cta"
                  />
                }
              >
                Explore Our Services
              </Button>
            </div>

            <ul className="mt-9 flex flex-col gap-4 border-t border-line/80 pt-6 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
              {FEATURES.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.label}
                    className="flex min-h-11 items-center gap-2.5 font-display text-sm font-semibold text-navy"
                  >
                    <Icon
                      stroke={1.5}
                      className="size-[18px] shrink-0 text-green-strong"
                      aria-hidden
                    />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hero-enter-delay relative lg:col-span-7">
            {/* Soft bloom behind the frame — kills the hard card silhouette */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[40%] bg-[radial-gradient(circle_at_60%_45%,rgb(147_198_61/0.22),rgb(17_148_70/0.08)_45%,transparent_70%)] blur-2xl sm:-inset-10"
            />

            <LimeArc className="absolute -right-2 -top-4 z-[1] size-36 opacity-90 sm:size-44 lg:size-52" />

            <ResponsiveImageFrame
              src="/images/hero/beepa-team-hero.webp"
              alt="Beepa professionals collaborating in a bright office"
              priority
              frame="blend"
              className="aspect-[4/3] w-full md:aspect-[5/4] lg:min-h-[460px]"
              sizes="(max-width: 1024px) 100vw, 58vw"
              imageClassName="object-[center_28%] scale-[1.02] md:object-[72%_center]"
            />

            <p className="hero-caption mt-5 max-w-[28ch] font-display text-xs font-semibold uppercase tracking-[0.14em] text-green-strong/90 sm:mt-6 sm:text-[13px]">
              Great people build brighter tomorrow
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
