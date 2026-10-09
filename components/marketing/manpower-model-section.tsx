import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/beepa/focus-ring";
import { EyebrowPill } from "@/components/marketing/landing-primitives";
import type { TablerIcon } from "@tabler/icons-react";
import {
  IconClipboardSearch,
  IconUsersGroup,
  IconCash,
} from "@tabler/icons-react";

const STEPS = [
  {
    word: "Search",
    line: "Role brief, sourcing, and shortlists against the skills and hours you need.",
    icon: IconClipboardSearch as TablerIcon,
  },
  {
    word: "Place",
    line: "People start on your tools, in your process, on your schedule.",
    icon: IconUsersGroup as TablerIcon,
  },
  {
    word: "Pay",
    line: "Beepa runs salary and employment admin. You do not build a payroll stack.",
    icon: IconCash as TablerIcon,
  },
] as const;


export function ManpowerModelSection() {
  return (
    <section
      id="how-we-work"
      data-manpower-model
      aria-labelledby="manpower-heading"
      className="relative isolate overflow-x-clip scroll-mt-24 bg-mist pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-14 lg:pb-20"
    >
      {/* Soft ambient tints */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-[-12%] -z-10 h-[420px] w-[420px] rounded-full bg-white/80 [mask-image:radial-gradient(closest-side,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-[-14%] -z-10 h-[400px] w-[400px] rounded-full bg-soft-green/45 [mask-image:radial-gradient(closest-side,black,transparent_75%)]"
      />

      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
          <Reveal className="lg:col-span-7">
            <EyebrowPill>The three-step model</EyebrowPill>

            <h2
              id="manpower-heading"
              className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance sm:mt-5"
            >
              <span className="block text-navy">Search. Place.</span>
              <span className="block">
                <span className="relative inline-block whitespace-nowrap">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-1 -z-10 h-[0.42em] rounded-[3px] bg-lime/45"
                  />
                  <span className="relative text-green-strong">Pay</span>
                </span>
                <span className="text-navy">.</span>
              </span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Beepa is a manpower partner for BPO teams. We search for talent,
              place them on your team, and run salary so you keep the work.
            </p>
          </Reveal>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:col-span-5 lg:col-start-8 lg:justify-end">
            <Link
              href="/contact"
              data-analytics="manpower_primary_cta"
              className={cn(
                "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-green-strong px-6 font-display text-base font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green",
                focusRing,
              )}
            >
              Request a team
              <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 motion-reduce:translate-x-0">
                <IconArrowRight
                  stroke={1.75}
                  className="size-3.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
            <Link
              href="/why-beepa"
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-navy/20 bg-white px-6 font-display text-base font-semibold text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                focusRing,
              )}
            >
              How we staff
            </Link>
          </div>
        </div>

        <Reveal>
          {/* Numbered process cards */}
          <ol className="mt-10 grid list-none grid-cols-1 gap-4 sm:mt-12 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.word}
                  className="rounded-[1.75rem] bg-white p-6 ring-1 ring-line shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-7 md:p-8"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-10 items-center justify-center rounded-[12px] bg-soft-green text-green-strong ring-1 ring-green-strong/15"
                    >
                      <Icon stroke={1.5} className="size-5" />
                    </span>
                    <span
                      aria-hidden
                      className="font-display text-[12px] font-semibold tracking-[0.18em] text-slate"
                    >
                      Step {idx + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-navy">
                    {step.word}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-pretty text-slate">
                    {step.line}
                  </p>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </Container>
    </section>
  );
}