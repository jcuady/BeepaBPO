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

export function WhyBeepaSection() {
  return (
    <section
      id="why-beepa"
      className="relative scroll-mt-24 overflow-hidden bg-white py-20 md:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 size-[280px] rounded-full bg-soft-green/80 blur-3xl md:size-[360px]"
      />

      <Container>
        <div className="grid items-stretch gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col justify-center lg:col-span-3">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-green-strong">
              Why Beepa
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.75rem,3vw,2.35rem)] font-bold leading-tight tracking-tight text-navy text-balance">
              A partner invested in your success.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate">
              We combine great people, operational excellence, and a genuine
              partnership mindset to help you achieve more.
            </p>
            <Button
              className="group mt-7 w-fit gap-2 active:scale-[0.98]"
              nativeButton={false}
              render={<Link href="/about" />}
            >
              Discover the Beepa Difference
              <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                <IconArrowRight stroke={2} className="size-3.5" />
              </span>
            </Button>
          </div>

          <ul className="grid grid-cols-1 gap-8 self-center sm:grid-cols-2 lg:col-span-4 lg:gap-x-8 lg:gap-y-10">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <li key={value.title} className="min-w-0">
                  <Icon
                    stroke={1.5}
                    className="size-7 text-green-strong"
                    aria-hidden
                  />
                  <h3 className="mt-3 font-display text-base font-bold text-navy">
                    {value.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate">
                    {value.description}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="relative min-h-[340px] overflow-hidden rounded-[22px] lg:col-span-5 lg:min-h-[460px]">
            {/* Composite art already includes script, arc, quote (mockup fidelity). */}
            <Image
              src="/images/sections/people-make-progress.png"
              alt="Beepa agent with headset — People Make Progress"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
