import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  IconArrowRight,
  IconChartBar,
  IconCoin,
  IconHeart,
  IconSearch,
  IconShieldCheck,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { FinalCTA } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/site";

export const metadata: Metadata = {
  title: "Why Beepa",
  description:
    "Why companies choose Beepa: we find the people, place them on your team, and handle salary — a manpower partner built for dependable delivery.",
  alternates: { canonical: "/why-beepa" },
};

const PILLARS = [
  {
    title: "People-first hiring",
    description:
      "We hire for attitude and train for the work — so the people we place stay and deliver.",
    icon: IconUsersGroup,
  },
  {
    title: "Reliable operations",
    description:
      "Clear briefs, screened shortlists, and placement into your tools and hours.",
    icon: IconShieldCheck,
  },
  {
    title: "Built to scale",
    description:
      "Add roles when you need them. We search again — without restarting your HR stack.",
    icon: IconChartBar,
  },
  {
    title: "A culture that cares",
    description:
      "People who are paid on time and treated well do better work for your customers.",
    icon: IconHeart,
  },
] as const;

const SPLIT = [
  {
    label: "You",
    items: [
      "Define the roles and outcomes",
      "Direct the day-to-day work",
      "Stay focused on your business",
    ],
  },
  {
    label: "Beepa",
    items: [
      "Search and shortlist talent",
      "Place people on your team",
      "Handle salary and pay admin",
    ],
  },
] as const;

export default function WhyBeepaPage() {
  return (
    <>
      <PageHero
        eyebrow="Why Beepa"
        title="A manpower partner invested in your team."
        description={
          <>
            {BRAND.displayName} finds the people you need and handles the pay —
            so you get working talent without building a full hiring and payroll
            operation yourself.
          </>
        }
        cta={{ href: "/contact", label: "Request talent" }}
        secondaryCta={{ href: "/services", label: "See services" }}
      />

      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid items-stretch gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="flex flex-col justify-center lg:col-span-5">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                The Beepa difference
              </p>
              <SectionHeading as="h2" className="mt-3">
                Find people. Handle pay. Keep it clear.
              </SectionHeading>
              <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-slate">
                We are not a consulting black box. You brief the role; we search,
                place, and manage salary so your team can focus on delivery.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] bg-mist p-5 ring-1 ring-line">
                  <IconSearch
                    stroke={1.5}
                    className="size-6 text-green-strong"
                    aria-hidden
                  />
                  <p className="mt-3 font-display text-base font-semibold text-navy">
                    Talent search
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate">
                    Source, screen, shortlist, place.
                  </p>
                </div>
                <div className="rounded-[20px] bg-navy p-5 text-white">
                  <IconCoin stroke={1.5} className="size-6 text-lime" aria-hidden />
                  <p className="mt-3 font-display text-base font-semibold text-white">
                    Payroll handled
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                    Salary stays with Beepa.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="h-full rounded-[1.75rem] bg-mist p-1.5 ring-1 ring-line sm:rounded-[2rem] sm:p-2">
                <div className="relative aspect-[4/3] min-h-[280px] w-full overflow-hidden rounded-[calc(1.75rem-0.35rem)] bg-navy/10 sm:rounded-[calc(2rem-0.4rem)] lg:min-h-[420px]">
                  <Image
                    src="/images/sections/why-beepa-agent.webp"
                    alt="Beepa support professional with headset in the office"
                    fill
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    quality={75}
                    className="object-cover object-[center_18%]"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-line/70 bg-mist/40 py-20 md:py-24">
        <Container>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-6">
              <SectionHeading as="h2">What you keep. What we take on.</SectionHeading>
            </div>
            <p className="max-w-[40ch] text-base leading-relaxed text-slate lg:col-span-6 lg:justify-self-end">
              A clean split so expectations stay honest from the first brief.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {SPLIT.map((column) => (
              <div
                key={column.label}
                className="rounded-[24px] bg-white p-8 ring-1 ring-line md:p-9"
              >
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                  {column.label}
                </p>
                <ul className="mt-6 space-y-4">
                  {column.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 border-b border-line pb-4 text-base text-navy last:border-0 last:pb-0"
                    >
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-lime"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-20 md:py-28">
        <Container>
          <SectionHeading as="h2">Why teams stay with Beepa</SectionHeading>
          <ul className="mt-12 grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <li
                  key={pillar.title}
                  className="border-line py-8 sm:px-6 sm:py-6 lg:px-7 sm:odd:pl-0 lg:[&:not(:first-child)]:border-l max-sm:[&:not(:first-child)]:border-t"
                >
                  <Icon
                    stroke={1.5}
                    className="size-7 text-green-strong"
                    aria-hidden
                  />
                  <h3 className="mt-4 font-display text-lg font-bold text-navy">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate">
                    {pillar.description}
                  </p>
                  <span className="sr-only">Pillar {index + 1}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-14 flex flex-col gap-4 border-t border-line pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[44ch] text-base leading-relaxed text-slate">
              Ready for a clearer staffing partner? Share the roles you need.
            </p>
            <Button
              className="group min-h-11 w-fit gap-2 rounded-full bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97]"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Let&apos;s talk
              <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                <IconArrowRight stroke={2} className="size-3" aria-hidden />
              </span>
            </Button>
          </div>
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}
