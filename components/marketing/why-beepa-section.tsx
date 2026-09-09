import Image from "next/image";
import Link from "next/link";
import {
  IconArrowRight,
  IconChartBar,
  IconHeart,
  IconShieldCheck,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";

const VALUES = [
  {
    title: "People-First",
    description: "We hire for attitude, train for excellence.",
    icon: IconUsersGroup,
  },
  {
    title: "Reliable & Secure",
    description: "Your data and trust are always protected.",
    icon: IconShieldCheck,
  },
  {
    title: "Built for Growth",
    description: "We scale with you, not just for you.",
    icon: IconChartBar,
  },
  {
    title: "A Culture That Cares",
    description: "Happy people deliver great work.",
    icon: IconHeart,
  },
] as const;

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export function WhyBeepaSection() {
  return (
    <section
      id="why-beepa"
      className="relative scroll-mt-24 overflow-hidden bg-navy py-24 md:py-32"
    >
      {/* Ambient glows + grain (static, paint-once) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-0 size-[480px] rounded-full bg-green/25 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 size-[420px] rounded-full bg-lime/15 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: NOISE }}
      />

      <Container className="relative">
        <div className="grid items-stretch gap-12 lg:grid-cols-12 lg:gap-10">
          <Reveal className="flex flex-col justify-center lg:col-span-4">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">
              Why Beepa
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.75rem,3vw,2.35rem)] font-bold leading-tight tracking-tight text-white text-balance">
              A partner invested in your success.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              We combine great people, operational excellence, and a genuine
              partnership mindset to help you achieve more.
            </p>
            <Button
              className="group mt-8 w-fit gap-2 rounded-full bg-lime text-navy transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white active:scale-[0.97]"
              nativeButton={false}
              render={<Link href="/why-beepa" />}
            >
              Discover the Beepa Difference
              <span className="flex size-7 items-center justify-center rounded-full bg-navy/10 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                <IconArrowRight stroke={2} className="size-3.5" aria-hidden />
              </span>
            </Button>
          </Reveal>

          <ul className="grid grid-cols-1 self-center sm:grid-cols-2 lg:col-span-4">
            {VALUES.map((value, index) => {
              const Icon = value.icon;
              return (
                <li
                  key={value.title}
                  className="group border-white/10 py-6 sm:px-6 sm:py-7 sm:odd:border-l-0 sm:odd:pl-0 sm:even:border-l sm:even:pr-0 sm:[&:nth-child(n+3)]:border-t max-sm:[&:not(:first-child)]:border-t"
                >
                  <Reveal delay={index * 80}>
                    <Icon
                      stroke={1.5}
                      className="size-7 text-lime transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-0.5"
                      aria-hidden
                    />
                    <h3 className="mt-3 font-display text-base font-bold text-white">
                      {value.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/65">
                      {value.description}
                    </p>
                  </Reveal>
                </li>
              );
            })}
          </ul>

          <Reveal delay={140} className="lg:col-span-4">
            {/* Double-bezel — mockup sec1 portrait card */}
            <div className="h-full rounded-[1.75rem] bg-white p-1.5 shadow-[0_24px_48px_-28px_rgb(0_0_0/0.45)] sm:rounded-[2rem] sm:p-2">
              <div className="relative aspect-[3/4] min-h-[340px] w-full overflow-hidden rounded-[calc(1.75rem-0.35rem)] bg-navy/20 sm:rounded-[calc(2rem-0.4rem)] lg:min-h-[460px]">
                <Image
                  src="/images/sections/why-beepa-agent.webp"
                  alt="Beepa support professional with headset in the office"
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  quality={75}
                  className="object-cover object-[center_18%]"
                  data-why-media="sec1"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
