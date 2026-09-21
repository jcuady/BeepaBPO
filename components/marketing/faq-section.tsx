import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

export function FAQSection({
  items = FAQ_ITEMS,
}: {
  items?: readonly { q: string; a: string }[];
}) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
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
              id="faq-heading"
              className="font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance"
            >
              <span className="block text-navy">Questions teams ask</span>
              <span className="block text-green-strong">before they start.</span>
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
              href="/services"
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-navy/20 bg-white px-6 font-display text-base font-semibold text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                focusRing,
              )}
            >
              All services
            </Link>
          </div>
        </div>

        <Reveal>
          {items.length === 0 ? (
            <p className="mt-10 max-w-[36ch] border-t border-line pt-8 text-base leading-relaxed text-slate sm:mt-12">
              No published questions yet. Request a team and we will walk
              through roles, sourcing, and pay.
            </p>
          ) : (
            <dl className="mt-10 border-t border-line sm:mt-12">
              {items.map((item) => (
                <div
                  key={item.q}
                  className="grid grid-cols-1 gap-2 border-b border-line py-5 last:border-b-0 sm:py-6 lg:grid-cols-12 lg:items-start lg:gap-8"
                >
                  <dt className="font-display text-base font-semibold tracking-tight text-pretty text-navy sm:text-lg lg:col-span-5">
                    {item.q}
                  </dt>
                  <dd className="text-sm leading-relaxed text-pretty text-slate sm:text-base lg:col-span-6 lg:col-start-7">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Reveal>
      </Container>
    </section>
  );
}
