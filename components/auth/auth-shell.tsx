import Image from "next/image";
import Link from "next/link";
import type { TablerIcon } from "@tabler/icons-react";
import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandYoutube,
  IconChartBar,
  IconHeartHandshake,
  IconPlant,
  IconUsers,
} from "@tabler/icons-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const SOCIALS = [
  { href: "https://linkedin.com", label: "LinkedIn", icon: IconBrandLinkedin },
  { href: "https://facebook.com", label: "Facebook", icon: IconBrandFacebook },
  { href: "https://instagram.com", label: "Instagram", icon: IconBrandInstagram },
  { href: "https://youtube.com", label: "YouTube", icon: IconBrandYoutube },
] as const;

const DEFAULT_VALUES = [
  {
    title: "Talented People",
    description: "Exceptional talent delivers real results.",
    icon: IconUsers,
  },
  {
    title: "Proven Processes",
    description: "Smarter operations for greater efficiency.",
    icon: IconChartBar,
  },
  {
    title: "Scalable Growth",
    description: "Flexible solutions that grow with you.",
    icon: IconPlant,
  },
  {
    title: "Trusted Partnership",
    description: "A team that's invested in your success.",
    icon: IconHeartHandshake,
  },
] as const;

export type AuthFeature = {
  label: string;
  description?: string;
  icon: TablerIcon;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  features,
  imageSrc,
  imageAlt,
  values = DEFAULT_VALUES,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  features: AuthFeature[];
  imageSrc: string;
  imageAlt: string;
  values?: readonly {
    title: string;
    description: string;
    icon: TablerIcon;
  }[];
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#F5F7F6]">
      <SiteHeader />

      <main className="relative flex-1">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-8 lg:py-14">
          {/* Form first on mobile (mockup), brand first on desktop */}
          <div className="order-1 flex justify-center lg:order-2 lg:col-span-5">
            <div className="w-full max-w-[440px]">
              <div className="mb-5 flex justify-center lg:mb-6">
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center"
                  aria-label="BEEPA home"
                >
                  <Image
                    src="/brand/beepa-logo-horizontal.png"
                    alt="BEEPA"
                    width={160}
                    height={50}
                    className="h-9 w-auto sm:h-10"
                    priority
                  />
                </Link>
              </div>
              {children}
            </div>
          </div>

          {/* Brand panel: desktop only — mobile uses photo strip below (mockup) */}
          <section className="relative hidden overflow-hidden rounded-[28px] bg-white lg:order-1 lg:col-span-7 lg:block">
            <div className="absolute inset-0">
              <Image
                src={imageSrc}
                alt=""
                fill
                priority
                sizes="58vw"
                className="object-cover object-[68%_center]"
                aria-hidden
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-white/30" />
            </div>

            <svg
              aria-hidden
              viewBox="0 0 420 420"
              className="pointer-events-none absolute -bottom-16 -left-20 z-[1] size-[340px]"
              fill="none"
            >
              <path
                d="M40 380C40 180 180 40 380 40"
                stroke="#93C63D"
                strokeWidth="48"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>

            {/* Mockup script accent on photo */}
            <p
              aria-hidden
              className="pointer-events-none absolute right-8 top-10 z-[1] max-w-[12ch] rotate-[-8deg] text-right text-[1.35rem] font-bold leading-tight text-navy/90"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              People power better business.
            </p>

            <div className="relative z-[2] flex min-h-[560px] flex-col justify-center p-12 xl:p-14">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-green-strong">
                {eyebrow}
              </p>
              <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.05] tracking-tight text-navy text-balance">
                {title}
              </h1>
              <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-slate sm:text-lg">
                {description}
              </p>

              <ul className="mt-8 space-y-4">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <li key={feature.label} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-green text-green-strong ring-1 ring-green-strong/10">
                        <Icon stroke={1.5} className="size-5" />
                      </span>
                      <div>
                        <p className="font-display text-sm font-bold text-navy">
                          {feature.label}
                        </p>
                        {feature.description ? (
                          <p className="mt-0.5 text-sm text-slate">
                            {feature.description}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>

        {/* Mobile photo footer accent */}
        <div className="mx-auto max-w-[1280px] px-4 pb-8 sm:px-6 lg:hidden">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[22px]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/10 to-transparent" />
            <svg
              aria-hidden
              viewBox="0 0 320 220"
              className="pointer-events-none absolute -right-6 top-0 h-full w-[55%]"
              fill="none"
            >
              <path
                d="M20 200C20 80 120 20 300 20"
                stroke="#93C63D"
                strokeWidth="28"
                strokeLinecap="round"
              />
            </svg>
            <p
              className="absolute bottom-5 left-5 right-5 font-display text-xl font-bold italic leading-snug text-white"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              People power better business.
            </p>
          </div>
          <p className="mt-4 text-center font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">
            Great people build brighter tomorrow
          </p>
        </div>
      </main>

      <footer className="border-t border-line/80 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm text-slate">
            &copy; {year} {SITE.legalName}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate">
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center hover:text-green-strong"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center hover:text-green-strong"
            >
              Terms of Service
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center hover:text-green-strong"
            >
              Contact Us
            </Link>
            <div className="flex items-center gap-3">
              {SOCIALS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="inline-flex size-11 items-center justify-center text-navy transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-green-strong"
                  >
                    <Icon stroke={1.5} className="size-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-line/70 bg-[#F3F7F1]">
          <ul className="mx-auto grid max-w-[1280px] gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {values.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-green-strong ring-1 ring-green-strong/15",
                    )}
                  >
                    <Icon stroke={1.5} className="size-4" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold text-navy">
                      {item.title}
                    </p>
                    <p className="text-xs leading-relaxed text-slate">
                      {item.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </footer>
    </div>
  );
}
