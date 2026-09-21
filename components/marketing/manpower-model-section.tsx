import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    word: "Search",
    line: "Role brief, sourcing, and shortlists against the skills and hours you need.",
  },
  {
    word: "Place",
    line: "People start on your tools, in your process, on your schedule.",
  },
  {
    word: "Pay",
    line: "Beepa runs salary and employment admin. You do not build a payroll stack.",
  },
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

export function ManpowerModelSection() {
  return (
    <section
      id="how-we-work"
      data-manpower-model
      aria-labelledby="manpower-heading"
      className="relative scroll-mt-24 overflow-x-clip bg-white pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-10 lg:pb-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-0 size-[18rem] rounded-full bg-soft-green blur-[90px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-8rem] top-24 hidden size-[22rem] rounded-full bg-mist blur-[80px] lg:block"
      />

      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
          <Reveal className="lg:col-span-7">
            <h2
              id="manpower-heading"
              className="font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance"
            >
              <span className="block text-navy">Search. Place.</span>
              <span className="block text-green-strong">Pay.</span>
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
                "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-green px-6 font-display text-base font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green-strong",
                focusRing,
              )}
            >
              Request a team
              <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5">
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
                "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-navy/20 bg-white px-6 font-display text-base font-semibold text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                focusRing,
              )}
            >
              How we staff
            </Link>
          </div>
        </div>

        <Reveal>
          <ol className="mt-10 list-none border-t border-line sm:mt-12">
            {STEPS.map((step) => (
              <li
                key={step.word}
                className="grid grid-cols-1 gap-2 border-b border-line py-5 last:border-b-0 sm:py-6 lg:grid-cols-12 lg:items-start lg:gap-8"
              >
                <h3 className="font-display text-base font-semibold tracking-tight text-navy sm:text-lg lg:col-span-5">
                  {step.word}
                </h3>
                <p className="text-sm leading-relaxed text-pretty text-slate sm:text-base lg:col-span-6 lg:col-start-7">
                  {step.line}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>
      </Container>
    </section>
  );
}
