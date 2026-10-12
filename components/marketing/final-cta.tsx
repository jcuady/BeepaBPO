import {
  IconClock24,
  IconSparkles,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { EyebrowPill, MarketingCta } from "@/components/marketing/landing-primitives";


export function FinalCTA() {
  return (
    <section
      id="get-started"
      data-final-cta
      aria-labelledby="final-cta-heading"
      className="relative isolate overflow-x-clip scroll-mt-24 pt-8 pb-16 sm:pt-10 sm:pb-20 lg:pt-16 lg:pb-24"
    >
      {/* Soft ambient tints — pastel-mint scene base */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-soft-green/45 via-mist/45 to-white"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-[-10%] -z-10 h-[460px] w-[460px] rounded-full bg-soft-green/55 [mask-image:radial-gradient(closest-side,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-[-12%] -z-10 h-[460px] w-[460px] rounded-full bg-white/85 [mask-image:radial-gradient(closest-side,black,transparent_75%)]"
      />

      <Container>
        <Reveal>
          {/* Mint bezel-frame card */}
          <div className="relative isolate rounded-[2rem] bg-white p-6 ring-1 ring-line shadow-[0_30px_60px_-32px_rgba(31,32,88,0.18),0_8px_24px_-12px_rgba(11,110,52,0.10)] sm:p-8 md:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
              <div className="lg:col-span-7">
                <EyebrowPill>Tell us what you need</EyebrowPill>

                <h2
                  id="final-cta-heading"
                  className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance sm:mt-5"
                >
                  <span className="block text-navy">Tell us the role.</span>
                  <span className="block">
                    <span className="relative inline-block whitespace-nowrap">
                      <span className="relative text-green-strong">
                        We staff it.
                      </span>
                    </span>
                    <span className="text-navy">.</span>
                  </span>
                </h2>
                <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
                  Share the BPO roles you need. Beepa searches, places, and pays
                  so you keep the work.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:col-span-5 lg:col-start-8 lg:justify-end">
                <MarketingCta href="/contact" analytics="final_cta">
                  Request a team
                </MarketingCta>
                <MarketingCta href="/why-beepa" variant="secondary">
                  How we staff
                </MarketingCta>
              </div>
            </div>

            {/* Floating accent chip — top-right of the card */}
            <div className="absolute -top-3 right-4 z-10 hidden items-center gap-2 rounded-none bg-white py-1.5 pr-3 pl-2.5 ring-1 ring-line shadow-[0_10px_24px_-12px_rgba(31,32,88,0.18)] md:flex md:right-6">
              <span
                aria-hidden
                className="flex size-5 items-center justify-center rounded-none bg-soft-green text-green-strong"
              >
                <IconSparkles stroke={1.5} className="size-3" />
              </span>
              <span className="font-display text-sm font-semibold tracking-tight text-navy">
                Average time to shortlist
              </span>
              <span className="font-display text-sm font-semibold tabular-nums text-green-strong">
                9 days
              </span>
              <IconClock24
                stroke={1.5}
                className="size-3.5 text-slate"
                aria-hidden
              />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}