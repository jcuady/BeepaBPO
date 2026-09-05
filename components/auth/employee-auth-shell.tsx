import Image from "next/image";
import Link from "next/link";
import {
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

export function EmployeeAuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-mist">
      <header className="border-b border-line bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex h-11 min-h-11 shrink-0 items-center" aria-label="BEEPA home">
            <Image
              src="/brand/beepa-logo-horizontal.png"
              alt="BEEPA"
              width={140}
              height={44}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Go to Website
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1280px] gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-14">
        {/* Form first on mobile */}
        <div className="order-1 lg:order-2 lg:col-span-5">
          {children}
        </div>

        <div className="order-2 space-y-6 lg:order-1 lg:col-span-7">
          <div>
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
              Internal Portal
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.75rem,5vw,2.75rem)] font-bold leading-[1.1] tracking-tight text-navy">
              Same people. Bigger possibilities.
            </h1>
            <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-slate">
              Access the tools, resources, and support you need to do your best
              work together.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MODULES.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  className="flex min-h-11 items-center gap-3 rounded-[12px] border border-line bg-white px-3 py-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-green text-green-strong">
                    <Icon stroke={1.75} className="size-5" />
                  </span>
                  <span className="font-display text-sm font-semibold text-navy">
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-white ring-1 ring-line sm:aspect-[16/10] lg:aspect-[5/3]">
            <Image
              src="/images/auth/employee-portal.webp"
              alt="Beepa team member working in the office"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover object-center"
              priority
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-5 text-sm text-slate sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} {SITE.legalName}. All rights
            reserved.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/privacy" className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-green-strong">
              Privacy
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-green-strong">
              Terms
            </Link>
            <Link href="/contact" className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-green-strong">
              Contact
            </Link>
          </div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-navy">
            {SITE.tagline}
          </p>
        </div>
      </footer>
    </div>
  );
}
