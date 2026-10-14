import Image from "next/image";
import Link from "next/link";
import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandYoutube,
  IconCalendarCheck,
  IconChartBar,
  IconUserPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { BRAND, SITE } from "@/lib/site";

const MODULES = [
  {
    label: "Attendance and Leave",
    description: "Clock, schedules, and time-off in one place.",
    icon: IconCalendarCheck,
  },
  {
    label: "HR Services and Requests",
    description: "Requests, documents, and support workflows.",
    icon: IconUserPlus,
  },
  {
    label: "Performance and Development",
    description: "Goals, feedback, and growth tools.",
    icon: IconChartBar,
  },
] as const;

const SOCIALS = [
  { href: "https://linkedin.com", label: "LinkedIn", icon: IconBrandLinkedin },
  { href: "https://facebook.com", label: "Facebook", icon: IconBrandFacebook },
  { href: "https://instagram.com", label: "Instagram", icon: IconBrandInstagram },
  { href: "https://youtube.com", label: "YouTube", icon: IconBrandYoutube },
] as const;

export function EmployeeAuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-mist">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex h-11 min-h-11 shrink-0 items-center"
            aria-label={`${BRAND.displayName} home`}
          >
            <Image
              src={BRAND.logoUrl}
              alt={BRAND.displayName}
              width={160}
              height={50}
              className="h-8 w-auto max-w-[132px] object-contain object-left sm:h-9 sm:max-w-none"
              priority
            />
          </Link>

          <nav
            className="hidden items-center gap-6 lg:flex xl:gap-7"
            aria-label="Internal"
          >
            {[
              { href: "/", label: "Home" },
              { href: "/about", label: "About" },
              { href: "/careers", label: "Careers" },
              { href: "/resources", label: "Resources" },
              { href: "/contact", label: "Support" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="inline-flex min-h-11 items-center px-2 font-display text-sm font-medium text-navy/70 transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-green-strong"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Button
            size="sm"
            variant="outline"
            className="group shrink-0 gap-2 border-navy/20 text-navy hover:bg-mist"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Go to Website
            <span className="flex size-6 items-center justify-center rounded-none bg-navy/5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
              →
            </span>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-8 lg:py-14">
          <div className="order-1 flex justify-center lg:order-2 lg:col-span-5">
            <div className="w-full max-w-[440px]">
              <div className="mb-5 flex justify-center lg:mb-6">
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center"
                  aria-label={`${BRAND.displayName} home`}
                >
                  <Image
                    src={BRAND.logoUrl}
                    alt={BRAND.displayName}
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

          <section className="relative hidden overflow-hidden rounded-none bg-white lg:order-1 lg:col-span-7 lg:block">
            <div className="absolute inset-0">
              <Image
                src="/images/services/customer-support-floor.webp"
                alt=""
                fill
                priority
                loading="eager"
                sizes="58vw"
                className="object-cover object-[70%_center]"
                aria-hidden
              />
              {/* Same navy photo scrim as AuthShell — see the note there. The
                  white-out gradient this replaces left Slate copy sitting on raw
                  photography at 1.38:1. */}
              <div className="absolute inset-0 bg-navy/88" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/45 to-navy/35" />
            </div>

            <svg
              aria-hidden
              viewBox="0 0 420 420"
              className="pointer-events-none absolute -bottom-16 -right-20 z-[1] size-[280px] scale-x-[-1] sm:size-[340px]"
              fill="none"
            >
              <path
                d="M40 380C40 180 180 40 380 40"
                className="stroke-lime"
                strokeWidth="48"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>

            <div className="relative z-[2] flex min-h-[560px] flex-col justify-center p-12">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">
                Internal Portal
              </p>
              <h1 className="mt-4 max-w-[14ch] font-display text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.05] tracking-tight text-white text-balance">
                Same people. Bigger possibilities.
              </h1>
              <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-white/85 sm:text-lg">
                Access the tools, resources, and support to do your best work —
                together.
              </p>

              <ul className="mt-8 space-y-4">
                {MODULES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <li key={feature.label} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-lime ring-1 ring-white/20">
                        <Icon stroke={1.5} className="size-5" />
                      </span>
                      <div>
                        <p className="font-display text-sm font-bold text-white">
                          {feature.label}
                        </p>
                        <p className="mt-0.5 text-base md:text-sm text-white/80">
                          {feature.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 pb-8 sm:px-6 lg:hidden">
          <div className="relative aspect-[16/10] overflow-hidden rounded-none">
            <Image
              src="/images/services/customer-support-floor.webp"
              alt="Beepa support floor"
              fill
              loading="eager"
              sizes="(max-width: 1024px) 100vw, 42rem"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 font-display text-xl font-semibold tracking-[-0.01em] text-white">
              Same people. Bigger possibilities.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-line/80 bg-white py-5">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-base md:text-sm text-slate">
            &copy; {year} {SITE.legalName}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate">
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-green-strong">
              Privacy Policy
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-green-strong">
              Terms of Service
            </Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center hover:text-green-strong">
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
                    className="inline-flex size-11 items-center justify-center text-navy hover:text-green-strong"
                  >
                    <Icon stroke={1.5} className="size-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
