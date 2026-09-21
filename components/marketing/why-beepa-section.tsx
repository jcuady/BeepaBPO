import Link from "next/link";
import Image from "next/image";
import { IconArrowRight } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";
import whyAgentPhoto from "../../public/images/sections/why-beepa-agent.webp";

const SPLIT = [
  {
    label: "You",
    items: [
      "Brief the role and the outcome",
      "Direct the day-to-day work",
      "Keep your tools, hours, and standard",
    ],
  },
  {
    label: "Beepa",
    items: [
      "Search, screen, and shortlist",
      "Place people on your team",
      "Run salary and employment admin",
    ],
  },
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

export function WhyBeepaSection() {
  return (
    <section
      id="why-beepa"
      aria-labelledby="why-beepa-heading"
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
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-5">
            <h2
              id="why-beepa-heading"
              className="font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance"
            >
              <span className="block text-navy">We find the people.</span>
              <span className="block text-green-strong">You keep the process.</span>
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
                  "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-green px-6 font-display text-base font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:bg-green-strong",
                  focusRing,
                )}
              >
                How we staff
                <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5">
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
                  "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-navy/20 bg-white px-6 font-display text-base font-semibold text-navy transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:w-auto [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist",
                  focusRing,
                )}
              >
                Request a team
              </Link>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-6 lg:col-start-7">
            <figure className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-mist shadow-[0_24px_48px_-28px_rgb(31_32_88_/_0.35)] sm:aspect-[16/10] lg:aspect-[4/3] lg:rounded-[1.75rem]">
              <Image
                src={whyAgentPhoto}
                alt="Beepa support professional with headset in the office"
                fill
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 48vw"
                quality={70}
                data-why-media="sec1"
                className="object-cover object-[center_18%]"
              />
            </figure>
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-10 grid grid-cols-1 gap-0 border-t border-line sm:mt-12 md:grid-cols-2">
            {SPLIT.map((column) => (
              <div
                key={column.label}
                className="border-b border-line p-6 last:border-b-0 md:border-b-0 md:border-r md:p-7 md:last:border-r-0"
              >
                <p className="font-display text-sm font-semibold text-green-strong">
                  {column.label}
                </p>
                <ul className="mt-4 space-y-3">
                  {column.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-sm leading-relaxed text-navy"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-lime"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
