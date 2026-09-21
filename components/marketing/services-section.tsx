import Link from "next/link";
import Image from "next/image";
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
import { SERVICES_CATALOG } from "@/lib/marketing/services-catalog";
import { cn } from "@/lib/utils";
import supportFloorPhoto from "../../public/images/services/customer-support-floor.png";

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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

export function ServicesSection() {
  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="relative scroll-mt-24 overflow-x-clip bg-white pt-8 pb-12 sm:pt-10 sm:pb-14 lg:pt-10 lg:pb-16"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-8 size-[16rem] rounded-full bg-soft-green blur-[90px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-8rem] top-32 hidden size-[20rem] rounded-full bg-mist blur-[80px] lg:block"
      />

      <Container>
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-5">
            <h2
              id="services-heading"
              className="font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-balance"
            >
              <span className="block text-navy">BPO teams that</span>
              <span className="block text-green-strong">fit your process.</span>
            </h2>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-pretty text-slate sm:mt-5 sm:text-lg">
              Support, ops, IT, marketing, eLearning, and more. Beepa sources
              the people and runs payroll. You keep the tools, hours, and
              standard.
            </p>
            <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/contact"
                data-analytics="services_featured_cta"
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
          </Reveal>

          <Reveal className="lg:col-span-6 lg:col-start-7">
            <figure className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-mist shadow-[0_24px_48px_-28px_rgb(31_32_88_/_0.35)] sm:aspect-[16/10] lg:aspect-[4/3] lg:rounded-[1.75rem]">
              <Image
                src={supportFloorPhoto}
                alt="Beepa customer support agent on headset at her desk, with teammates working in the background"
                fill
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 48vw"
                quality={70}
                className="object-cover object-[50%_22%] lg:object-[48%_28%]"
              />
            </figure>
          </Reveal>
        </div>

        <Reveal>
          {/* 2-col hairline list — avoids equal 3/4 card grids at 10 roles */}
          <ul className="mt-10 grid grid-cols-1 gap-0 border-t border-line sm:mt-12 md:grid-cols-2">
            {ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <li
                  key={role.href}
                  className="border-b border-line md:odd:border-r md:odd:border-line"
                >
                  <Link
                    href={role.href}
                    className={cn(
                      "group flex min-h-[7.5rem] items-start gap-4 p-5 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] sm:min-h-[8rem] sm:p-6 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-mist/70",
                      focusRing,
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-soft-green text-green-strong ring-1 ring-green-strong/10">
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
                      <p className="mt-1 text-sm leading-relaxed text-slate">
                        {role.hook}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-green-strong">
                        Role details
                        <IconArrowRight
                          stroke={2}
                          className="size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5"
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
