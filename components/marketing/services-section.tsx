import Link from "next/link";
import {
  IconArrowRight,
  IconChartBar,
  IconDeviceDesktop,
  IconFileDescription,
  IconHeadset,
  IconHeartHandshake,
  IconKeyboard,
  IconPresentation,
  IconSchool,
  IconSpeakerphone,
  IconUsers,
} from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingCta } from "@/components/marketing/landing-primitives";
import { SERVICES_CATALOG } from "@/lib/marketing/services-catalog";
import { cn } from "@/lib/utils";
import supportFloorPhoto from "../../public/images/services/customer-support-floor.png";
import { focusRing } from "@/components/beepa/focus-ring";
import {
  BezelFrame,
  EyebrowPill,
  StatusPill,
} from "@/components/marketing/landing-primitives";
import { IconClock24, IconHeadphones } from "@tabler/icons-react";

const ICON_BY_SLUG: Record<string, TablerIcon> = {
  "customer-support": IconHeadset,
  "back-office": IconFileDescription,
  "virtual-assistants": IconUsers,
  "sales-support": IconChartBar,
  "it-support": IconDeviceDesktop,
  marketing: IconSpeakerphone,
  "elearning-course-dev": IconSchool,
  "slide-creator": IconPresentation,
  "data-entry": IconKeyboard,
  "customer-relations": IconHeartHandshake,
};

const ROLES = SERVICES_CATALOG.map((item) => ({
  title: item.shortLabel,
  hook: item.hook,
  href: `/services#${item.slug}`,
  icon: ICON_BY_SLUG[item.slug] ?? IconUsers,
}));


export function ServicesSection() {
  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="relative isolate overflow-x-clip scroll-mt-24 bg-white pt-8 pb-12 sm:pt-10 sm:pb-14 lg:pt-12 lg:pb-16"
    >
      {/* Soft ambient tints for visual continuity with the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-12%] -z-10 h-[480px] w-[480px] rounded-full bg-soft-green/45 [mask-image:radial-gradient(closest-side,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-[-14%] -z-10 h-[420px] w-[420px] rounded-full bg-mist [mask-image:radial-gradient(closest-side,black,transparent_75%)]"
      />

      <Container>
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <Reveal className="lg:col-span-5">
            <EyebrowPill index="01">What we staff</EyebrowPill>

            <h2
              id="services-heading"
              className="mt-4 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight sm:mt-5"
            >
              <span className="block text-navy">BPO teams that</span>
              <span className="block">
                <span className="relative inline-block whitespace-nowrap">
                  <span className="relative text-green-strong">
                    fit your process
                  </span>
                </span>
                <span className="text-navy">.</span>
              </span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Support, ops, IT, marketing, eLearning, and more. Beepa sources
              the people and runs payroll. You keep the tools, hours, and
              standard.
            </p>
            <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
              <MarketingCta href="/contact" analytics="services_featured_cta">
                Request a team
              </MarketingCta>
              <MarketingCta href="/services" variant="secondary">
                All services
              </MarketingCta>
            </div>
          </Reveal>

          <Reveal className="relative isolate lg:col-span-6 lg:col-start-7">
            <BezelFrame
              src={supportFloorPhoto}
              alt="Beepa customer support agent on headset at her desk, with teammates working in the background"
              sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 48vw"
              aspectClassName="aspect-[4/3]"
              objectClassName="object-cover object-[50%_22%] lg:object-[48%_28%]"
            />
            {/* Floating status pill — top-right */}
            <div className="absolute -top-3 right-4 z-10 md:right-6">
              <StatusPill icon={IconHeadphones} trailingIcon={IconClock24}>
                Customer support · 14 teams
              </StatusPill>
            </div>
          </Reveal>
        </div>

        <Reveal>
          {/* 2-col role rail — hairline list, not a 4-up card grid */}
          <ul className="mt-10 grid grid-cols-1 gap-0 sm:mt-12 md:grid-cols-2">
            {ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <li
                  key={role.href}
                  className="border-t border-line first:border-t-0 md:odd:border-r md:odd:border-line"
                >
                  <Link
                    href={role.href}
                    className={cn(
                      "group flex min-h-[7.5rem] items-start gap-4 px-5 py-5 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] sm:min-h-[8rem] sm:px-6 sm:py-6 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist/70",
                      focusRing,
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-none bg-soft-green text-green-strong ring-1 ring-green-strong/10">
                      <Icon
                        stroke={1.5}
                        className="size-5"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-bold tracking-tight text-navy">
                        {role.title}
                      </h3>
                      <p className="mt-1 text-base leading-relaxed text-slate">
                        {role.hook}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-green-strong">
                        Role details
                        <IconArrowRight
                          stroke={2}
                          className="size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 motion-reduce:translate-x-0"
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}