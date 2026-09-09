"use client";

import Link from "next/link";
import Image from "next/image";
import {
  IconArrowRight,
  IconChartBar,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";

const FEATURES = [
  { label: "Talented People", icon: IconUsers },
  { label: "Proven Processes", icon: IconSettings },
  { label: "Real Business Impact", icon: IconChartBar },
] as const;

export function HeroSection() {
  return (
    <section className="relative overflow-x-hidden bg-white pb-4 pt-6 sm:pb-6 sm:pt-8 md:pt-10">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8 xl:gap-12">
          <div className="hero-enter relative z-10 lg:col-span-5">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-green-strong">
              People · Process · Progress
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,5vw,3.85rem)] font-bold leading-[1.05] tracking-tight text-balance">
              <span className="text-navy">People power </span>
              <span className="text-green-strong">better business.</span>
            </h1>
            <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-slate sm:mt-6 md:text-lg">
              Dependable teams. Smarter operations. A trusted outsourcing
              partner helping you scale with confidence.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                size="lg"
                className="group min-h-11 w-full gap-2 px-5 active:scale-[0.98] sm:w-auto"
                nativeButton={false}
                render={
                  <Link href="/contact" data-analytics="hero_primary_cta" />
                }
              >
                Let&apos;s Talk
                <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                  <IconArrowRight stroke={2} className="size-3.5" />
                </span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-11 w-full border-navy/25 bg-white px-5 text-navy hover:bg-mist active:scale-[0.98] sm:w-auto"
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

            <ul className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
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
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[22px] md:aspect-[5/4] md:rounded-[28px] lg:min-h-[420px]">
              <Image
                src="/images/hero/beepa-team-hero.webp"
                alt="Beepa professionals collaborating in a bright office"
                fill
                priority
                quality={75}
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-cover object-[center_28%] md:object-[72%_center]"
              />

              {/* Thick green arc framing the right side — mockup fidelity */}
              <svg
                aria-hidden
                viewBox="0 0 420 520"
                className="pointer-events-none absolute -right-6 -top-8 z-[1] h-[115%] w-[58%] sm:-right-4"
                fill="none"
              >
                <path
                  d="M80 500C80 220 220 40 420 40"
                  stroke="#93C63D"
                  strokeWidth="42"
                  strokeLinecap="round"
                  opacity="0.95"
                />
              </svg>

              <aside className="absolute bottom-[10%] right-0 top-[10%] z-[2] flex w-[min(32%,9.5rem)] items-center justify-center bg-green-strong px-3 py-6 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] sm:w-[8.75rem]">
                <p className="font-display text-[13px] font-bold leading-snug text-white sm:text-sm">
                  Great People Build Brighter Tomorrow
                </p>
              </aside>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
