import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

export function FinalCTA() {
  return (
    <section
      id="get-started"
      data-final-cta
      aria-labelledby="final-cta-heading"
      className="relative scroll-mt-24 overflow-x-clip bg-white pt-8 pb-16 sm:pt-10 sm:pb-20 lg:pt-10 lg:pb-24"
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
              id="final-cta-heading"
              className="font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance"
            >
              <span className="block text-navy">Tell us the role.</span>
              <span className="block text-green-strong">We staff it.</span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Share the BPO roles you need. Beepa searches, places, and pays so
              you keep the work.
            </p>
          </Reveal>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:col-span-5 lg:col-start-8 lg:justify-end">
            <Link
              href="/contact"
              data-analytics="final_cta"
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
      </Container>
    </section>
  );
}
