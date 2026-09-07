import Image from "next/image";
import Link from "next/link";
import {
  IconBrandLinkedin,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandYoutube,
  IconCalendarCheck,
  IconChartBar,
  IconCheckbox,
  IconFileDescription,
  IconTicket,
  IconUserPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

const MODULES = [
  { label: "Attendance and Leave", icon: IconCalendarCheck },
  { label: "Payroll and Benefits", icon: IconFileDescription },
  { label: "HR Services and Requests", icon: IconUserPlus },
  { label: "IT Support and Tickets", icon: IconTicket },
  { label: "Performance and Development", icon: IconChartBar },
  { label: "Approvals and Workflows", icon: IconCheckbox },
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
      <header className="sticky top-0 z-40 h-14 bg-white pt-[env(safe-area-inset-top)] sm:h-[72px]">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex h-11 min-h-11 shrink-0 items-center" aria-label="BEEPA home">
            <Image
              src="/brand/beepa-logo-horizontal.png"
              alt="BEEPA"
              width={160}
              height={50}
              className="h-8 w-auto max-w-[132px] object-contain object-left sm:h-9 sm:max-w-none"
              priority
            />
          </Link>
          
          <nav className="hidden items-center gap-6 lg:flex xl:gap-7" aria-label="Internal">
            {["Home", "About", "Careers", "People", "Resources", "Support"].map((label) => (
              <Link
                key={label}
                href="/"
                className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap px-2 font-display text-sm font-medium text-navy opacity-70 hover:opacity-100"
              >
                {label}
              </Link>
            ))}
          </nav>

          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-green-strong border-green-strong hover:bg-soft-green"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Go to Website &rarr;
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Column */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[24px] bg-white p-8 shadow-sm sm:p-10 lg:col-span-7 xl:p-12">
            <div className="absolute -left-24 bottom-0 h-96 w-96 rounded-full border-[40px] border-soft-green opacity-50" />
            
            <div className="relative z-10 max-w-xl">
              <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-green-strong">
                INTERNAL PORTAL
              </p>
              <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.05] tracking-tight text-navy">
                Same people. Bigger possibilities.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate sm:text-lg">
                Access the tools, resources, and support you need to do your best work — together.
              </p>

              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {MODULES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <li key={feature.label} className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-green text-green-strong">
                        <Icon stroke={2} className="size-5" />
                      </div>
                      <p className="font-display text-sm font-bold text-navy">
                        {feature.label}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="relative z-10 mt-12 aspect-[4/3] w-full overflow-hidden rounded-[16px] sm:aspect-[16/9] lg:absolute lg:-bottom-8 lg:-right-8 lg:mt-0 lg:h-[85%] lg:w-[55%] lg:rounded-tl-[24px]">
              <Image
                src="/images/auth/internal-sign-in.png"
                alt="Beepa employee"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
                priority
              />
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="flex items-center justify-center lg:col-span-5">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center">
                <Link href="/" className="inline-flex min-h-11 items-center justify-center">
                  <Image
                    src="/brand/beepa-logo-horizontal.png"
                    alt="BEEPA"
                    width={160}
                    height={50}
                    className="h-10 w-auto"
                    priority
                  />
                </Link>
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-line bg-white py-6">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm text-slate">
            &copy; {year} {SITE.legalName}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate">
            <Link href="/privacy" className="hover:text-green-strong">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-green-strong">Terms of Service</Link>
            <Link href="/contact" className="hover:text-green-strong">Contact Us</Link>
            <div className="flex items-center gap-3 pl-2">
              {SOCIALS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="text-navy hover:text-green-strong"
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
