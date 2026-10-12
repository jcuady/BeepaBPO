import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";
import { EyebrowPill, MarketingCta } from "@/components/marketing/landing-primitives";
import type { TablerIcon } from "@tabler/icons-react";
import {
  IconRoute,
  IconUserCheck,
  IconTrendingUp,
} from "@tabler/icons-react";

const TRIAD = [
  {
    word: "People",
    line: "Talent on your team, paid by Beepa, who treat your work like their own.",
    icon: IconUserCheck as TablerIcon,
    accent: "soft-green" as const,
  },
  {
    word: "Process",
    line: "Briefs, shortlists, and placement so clients and staff stay aligned from day one.",
    icon: IconRoute as TablerIcon,
    accent: "mist" as const,
  },
  {
    word: "Progress",
    line: "Add roles when you need them, without restarting hiring from zero.",
    icon: IconTrendingUp as TablerIcon,
    accent: "lime" as const,
  },
] as const;


export function ProofStrip() {
  return (
    <section
      id="people-process-progress"
      data-proof-strip
      aria-labelledby="proof-heading"
      className="relative isolate overflow-x-clip scroll-mt-24 bg-white pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-14 lg:pb-20"
    >
      {/* Soft ambient tints */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-14%] -z-10 h-[440px] w-[440px] rounded-full bg-soft-green/45 [mask-image:radial-gradient(closest-side,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 left-[-14%] -z-10 h-[420px] w-[420px] rounded-full bg-mist [mask-image:radial-gradient(closest-side,black,transparent_75%)]"
      />

      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
          <Reveal className="lg:col-span-7">
            <EyebrowPill index="04">The Beepa operating model</EyebrowPill>

            <h2
              id="proof-heading"
              className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance sm:mt-5"
            >
              <span className="block text-navy">People. Process.</span>
              <span className="block">
                <span className="relative inline-block whitespace-nowrap">
                  <span className="relative text-green-strong">Progress</span>
                </span>
                <span className="text-navy">.</span>
              </span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Beepa&apos;s manpower model for BPO teams: we search, place, and
              pay. People, process, and progress are the operating model behind
              every placement.
            </p>
          </Reveal>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:col-span-5 lg:col-start-8 lg:justify-end">
            <MarketingCta href="/contact" analytics="proof_primary_cta">
              Request a team
            </MarketingCta>
            <MarketingCta href="/case-studies" variant="secondary">
              Case studies
            </MarketingCta>
          </div>
        </div>

        <Reveal>
          {/* Triad — pastel-tinted cards in 3-up grid */}
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 md:grid-cols-3 md:gap-6">
            {TRIAD.map((item) => {
              const Icon = item.icon;
              const tone =
                item.accent === "soft-green"
                  ? "bg-soft-green/55 ring-green-strong/10"
                  : item.accent === "mist"
                    ? "bg-mist ring-line"
                    : "bg-lime/20 ring-lime/40";
              return (
                <li
                  key={item.word}
                  className={cn(
                    "rounded-none p-6 ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-7 md:p-8",
                    tone,
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-10 items-center justify-center rounded-none bg-white text-green-strong ring-1 ring-green-strong/15"
                    >
                      <Icon stroke={1.5} className="size-5" />
                    </span>
                    <h3 className="font-display text-lg font-bold tracking-tight text-navy">
                      {item.word}
                    </h3>
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-pretty text-slate">
                    {item.line}
                  </p>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}