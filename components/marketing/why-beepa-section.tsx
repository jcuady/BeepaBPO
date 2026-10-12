import Link from "next/link";
import Image from "next/image";
import {
  IconArrowRight,
  IconCircleDot,
  IconClock24,
  IconUserCheck,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";
import whyAgentPhoto from "../../public/images/sections/why-beepa-agent.webp";
import { focusRing } from "@/components/beepa/focus-ring";
import {
  EyebrowPill,
  StatusPill,
} from "@/components/marketing/landing-primitives";

const SPLIT = [
  {
    label: "You",
    items: [
      "Brief the role and the outcome",
      "Direct the day-to-day work",
      "Keep your tools, hours, and standard",
    ],
    accent: "navy" as const,
  },
  {
    label: "Beepa",
    items: [
      "Search, screen, and shortlist",
      "Place people on your team",
      "Run salary and employment admin",
    ],
    accent: "green" as const,
  },
] as const;


export function WhyBeepaSection() {
  return (
    <section
      id="why-beepa"
      aria-labelledby="why-beepa-heading"
      className="relative isolate overflow-x-clip scroll-mt-24 bg-mist pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-14 lg:pb-20"
    >
      {/* Ambient tints — softer than white sections */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-[-14%] -z-10 h-[420px] w-[420px] rounded-full bg-white/80 [mask-image:radial-gradient(closest-side,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-[-12%] -z-10 h-[400px] w-[400px] rounded-full bg-soft-green/45 [mask-image:radial-gradient(closest-side,black,transparent_75%)]"
      />

      <Container>
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <Reveal className="lg:col-span-5">
            <EyebrowPill index="02">How we split the work</EyebrowPill>

            <h2
              id="why-beepa-heading"
              className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance sm:mt-5"
            >
              <span className="block text-navy">We find the people.</span>
              <span className="block">
                <span className="relative inline-block whitespace-nowrap">
                  <span className="relative text-green-strong">
                    You keep the process
                  </span>
                </span>
                <span className="text-navy">.</span>
              </span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Beepa is a manpower partner for BPO teams. We search, screen, and
              place. Payroll stays with us. The work stays on your tools.
            </p>
            <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/why-beepa"
                data-analytics="why_beepa_primary_cta"
                className={cn(
                  "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-none bg-green-strong px-6 font-display text-base font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green",
                  focusRing,
                )}
              >
                How we staff
                <span className="flex size-7 items-center justify-center rounded-none bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 motion-reduce:translate-x-0">
                  <IconArrowRight
                    stroke={1.75}
                    className="size-3.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
              <Link
                href="/contact"
                data-analytics="why_beepa_contact"
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded-none border border-navy/20 bg-white px-6 font-display text-base font-semibold text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                  focusRing,
                )}
              >
                Request a team
              </Link>
            </div>
          </Reveal>

          <Reveal className="relative isolate lg:col-span-6 lg:col-start-7">
            <div className="relative rounded-[2rem] bg-mist p-2 shadow-[0_30px_60px_-32px_rgba(31,32,88,0.22),0_8px_24px_-12px_rgba(11,110,52,0.10)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.625rem] bg-white/60 ring-1 ring-line/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <Image
                  src={whyAgentPhoto}
                  alt="Beepa support professional with headset in the office"
                  fill
                  quality={82}
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 48vw"
                  data-why-media="sec1"
                  className="object-cover object-[center_18%]"
                />
              </div>
            </div>
            {/* Floating status pill — top-right */}
            <div className="absolute -top-3 right-4 z-10 md:right-6">
              <StatusPill icon={IconUserCheck} trailingIcon={IconClock24}>
                47+ in-house teams
              </StatusPill>
            </div>
          </Reveal>
        </div>

        <Reveal>
          {/* Two-card split — pastel-tinted You / Beepa columns */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 md:grid-cols-2 md:gap-6">
            {SPLIT.map((column) => {
              const tintBg =
                column.accent === "navy"
                  ? "bg-white ring-line"
                  : "bg-soft-green/55 ring-green-strong/10";
              return (
                <div
                  key={column.label}
                  className={cn(
                    "rounded-[1.75rem] p-6 ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-7 md:p-8",
                    tintBg,
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-8 items-center justify-center rounded-[10px] ring-1",
                        column.accent === "navy"
                          ? "bg-mist text-navy ring-line"
                          : "bg-white text-green-strong ring-green-strong/15",
                      )}
                    >
                      <IconCircleDot stroke={1.5} className="size-4" />
                    </span>
                    <p
                      className={cn(
                        "font-display text-sm font-semibold tracking-tight",
                        column.accent === "navy" ? "text-navy" : "text-green-strong",
                      )}
                    >
                      {column.label}
                    </p>
                  </div>
                  <ul className="mt-5 space-y-3 sm:mt-6">
                    {column.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-base leading-relaxed text-pretty text-navy"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-2 size-1.5 shrink-0 rounded-full",
                            column.accent === "navy" ? "bg-slate/45" : "bg-lime",
                          )}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}