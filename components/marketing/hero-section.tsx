"use client";

import { useEffect, useRef } from "react";
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
  {
    label: "Talented People",
    description: "Operators who own outcomes",
    icon: IconUsers,
  },
  {
    label: "Proven Processes",
    description: "Clear rhythms, fewer surprises",
    icon: IconSettings,
  },
  {
    label: "Real Business Impact",
    description: "Results you can measure",
    icon: IconChartBar,
  },
] as const;

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let safety = 0;
    let ctx: { revert: () => void } | undefined;

    void import("gsap").then(({ default: gsap }) => {
      if (cancelled || !sectionRef.current) return;
      const nodes = sectionRef.current.querySelectorAll("[data-hero]");
      safety = window.setTimeout(() => {
        gsap.set(nodes, { opacity: 1, y: 0, scale: 1 });
      }, 2800);

      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: "expo.out" },
          onComplete: () => window.clearTimeout(safety),
        });
        tl.fromTo(
          "[data-hero='badge']",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
        )
          .fromTo(
            "[data-hero='title']",
            { y: 36, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.95 },
            "-=0.45",
          )
          .fromTo(
            "[data-hero='lede']",
            { y: 26, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8 },
            "-=0.65",
          )
          .fromTo(
            "[data-hero='ctas']",
            { y: 22, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7 },
            "-=0.55",
          )
          .fromTo(
            "[data-hero='media']",
            { y: 44, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 1.15 },
            "-=0.9",
          )
          .fromTo(
            "[data-hero='feature']",
            { y: 26, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.65, stagger: 0.1 },
            "-=0.75",
          );
      }, sectionRef);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      ctx?.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-x-clip bg-white pb-10 pt-8 sm:pb-12 sm:pt-10 md:pb-14 md:pt-12 lg:pb-16 lg:pt-14"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10 xl:gap-14">
          <div className="relative z-10 lg:col-span-5">
            <p
              data-hero="badge"
              className="inline-flex items-center rounded-full bg-soft-green px-3 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-green-strong ring-1 ring-green-strong/10"
            >
              People · Process · Progress
            </p>

            <h1
              data-hero="title"
              className="mt-5 max-w-[12ch] font-display text-[clamp(2.5rem,5.2vw,4rem)] font-bold leading-[1.02] tracking-tight text-balance sm:mt-6"
            >
              <span className="text-navy">People power </span>
              <span className="text-green-strong">better business.</span>
            </h1>

            <p
              data-hero="lede"
              className="mt-5 max-w-[40ch] text-base leading-relaxed text-slate sm:mt-6 sm:text-lg"
            >
              BeepoBPO builds dependable outsourced teams — smarter operations,
              clear support, and a people-first partner helping you scale with
              confidence.
            </p>

            <div
              data-hero="ctas"
              className="mt-8 flex w-full flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <Button
                size="lg"
                className="group min-h-11 w-full gap-2 rounded-full px-6 text-base transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto"
                nativeButton={false}
                render={
                  <Link href="/contact" data-analytics="hero_primary_cta" />
                }
              >
                Let&apos;s Talk
                <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                  <IconArrowRight stroke={1.75} className="size-3.5" aria-hidden />
                </span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-11 w-full rounded-full border-navy/20 bg-white px-6 text-base text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-navy/35 hover:bg-mist active:scale-[0.97] sm:w-auto"
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
          </div>

          <div data-hero="media" className="relative lg:col-span-7">
            {/* Double-bezel image frame */}
            <div className="rounded-[2rem] bg-black/[0.035] p-1.5 ring-1 ring-black/[0.06] sm:p-2">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[calc(2rem-0.4rem)] bg-mist md:aspect-[5/4] lg:min-h-[440px]">
                <Image
                  src="/images/hero/beepa-team-hero.webp"
                  alt="Beepa professionals collaborating in a bright office"
                  fill
                  priority
                  quality={75}
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover object-center"
                />

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
              </div>
            </div>
          </div>

          <ul className="grid border-t border-line sm:grid-cols-3 lg:col-span-12">
            {FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  data-hero="feature"
                  className="group flex items-center gap-4 border-t border-line px-1 py-6 first:border-t-0 sm:border-t-0 sm:px-6 sm:py-7 sm:not-first:border-l sm:not-first:border-line sm:first:pl-0 sm:last:pr-0"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-soft-green text-green-strong ring-1 ring-green-strong/10 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-rotate-3">
                    <Icon stroke={1.5} className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[15px] font-bold tracking-tight text-navy transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-green-strong">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug text-slate">
                      {item.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
