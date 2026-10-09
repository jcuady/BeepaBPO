import Link from "next/link";
import { IconArrowRight, IconHelp } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/beepa/focus-ring";
import { EyebrowPill } from "@/components/marketing/landing-primitives";

export const FAQ_ITEMS = [
  {
    q: "What roles can Beepa help us hire?",
    a: "Beepa supports customer support, back office, virtual assistants, sales support, and specialized roles shaped around your workflows.",
  },
  {
    q: "How does Beepa select professionals?",
    a: "We define requirements with you, source candidates who fit the brief, and involve you in interviews before any placement.",
  },
  {
    q: "Can Beepa support US business hours?",
    a: "Yes. Schedules are planned around how your business operates, including US hours where needed.",
  },
  {
    q: "How does onboarding work?",
    a: "Once a hire is confirmed, Beepa supports a structured start so your team can begin work with clear expectations and tools.",
  },
  {
    q: "Can we scale our team later?",
    a: "Yes. Beepa is built for flexible growth so teams and workflows can expand as your needs change.",
  },
  {
    q: "How do clients communicate with Beepa?",
    a: "You work with Beepa through dedicated support channels, and approved clients can use the Beepa platform for visibility and requests.",
  },
  {
    q: "How do we start?",
    a: "Share what your business needs. We begin with discovery, then define requirements and move into sourcing together.",
  },
] as const;


export function FAQSection({
  items = FAQ_ITEMS,
}: {
  items?: readonly { q: string; a: string }[];
}) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="relative isolate overflow-x-clip scroll-mt-24 bg-white pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-14 lg:pb-20"
    >
      {/* Soft ambient tints */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-[-12%] -z-10 h-[420px] w-[420px] rounded-full bg-soft-green/45 [mask-image:radial-gradient(closest-side,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-[-14%] -z-10 h-[440px] w-[440px] rounded-full bg-mist [mask-image:radial-gradient(closest-side,black,transparent_75%)]"
      />

      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
          <Reveal className="lg:col-span-7">
            <EyebrowPill>Frequently asked</EyebrowPill>

            <h2
              id="faq-heading"
              className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance sm:mt-5"
            >
              <span className="block text-navy">Questions teams ask</span>
              <span className="block">
                <span className="relative inline-block whitespace-nowrap">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-1 -z-10 h-[0.42em] rounded-[3px] bg-lime/45"
                  />
                  <span className="relative text-green-strong">
                    before they start
                  </span>
                </span>
                <span className="text-navy">.</span>
              </span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Straight answers on BPO roles, sourcing, US hours, onboarding, and
              how a Beepa manpower engagement works.
            </p>
          </Reveal>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:col-span-5 lg:col-start-8 lg:justify-end">
            <Link
              href="/contact"
              data-analytics="faq_primary_cta"
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
              href="/services"
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-navy/20 bg-white px-6 font-display text-base font-semibold text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                focusRing,
              )}
            >
              All services
            </Link>
          </div>
        </div>

        <Reveal>
          {items.length === 0 ? (
            <p className="mt-10 max-w-[36ch] rounded-[1.5rem] border border-line bg-mist/60 p-6 text-base leading-relaxed text-slate sm:mt-12">
              No published questions yet. Request a team and we will walk
              through roles, sourcing, and pay.
            </p>
          ) : (
            <dl className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 md:grid-cols-2 md:gap-6">
              {items.map((item, idx) => (
                <div
                  key={item.q}
                  className="rounded-[1.5rem] bg-white p-6 ring-1 ring-line shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-7"
                >
                  <div className="flex items-start gap-4">
                    <div className="lg:col-span-5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex size-9 items-center justify-center rounded-[10px] bg-soft-green text-green-strong ring-1 ring-green-strong/10"
                        >
                          <IconHelp stroke={1.5} className="size-4" />
                        </span>
                        <span
                          aria-hidden
                          className="font-display text-[12px] font-semibold tracking-[0.18em] text-slate"
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <dt className="mt-4 font-display text-base font-bold tracking-tight text-pretty text-navy sm:text-lg">
                        {item.q}
                      </dt>
                    </div>
                    <dd className="mt-1 text-base leading-relaxed text-pretty text-slate lg:col-span-6 lg:col-start-7">
                      {item.a}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </Reveal>
      </Container>
    </section>
  );
}