import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { EyebrowPill, MarketingCta } from "@/components/marketing/landing-primitives";
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
            <EyebrowPill index="06">The three-step model</EyebrowPill>

            <h2
              id="manpower-heading"
              className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance sm:mt-5"
            >
              <span className="block text-navy">Search. Place.</span>
              <span className="block">
                <span className="relative inline-block whitespace-nowrap">
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
            <MarketingCta href="/contact" analytics="manpower_primary_cta">
              Request a team
            </MarketingCta>
            <MarketingCta href="/why-beepa" variant="secondary">
              How we staff
            </MarketingCta>
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
                  className="rounded-none bg-white p-6 ring-1 ring-line shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-7 md:p-8"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-10 items-center justify-center rounded-none bg-soft-green text-green-strong ring-1 ring-green-strong/15"
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