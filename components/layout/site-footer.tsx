import Image from "next/image";
import Link from "next/link";
import {
  IconArrowRight,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandYoutube,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { BRAND, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const EXPLORE = [
  { href: "/about", label: "About" },
  { href: "/why-beepa", label: "Why Beepa" },
  { href: "/careers", label: "Careers" },
  { href: "/resources", label: "Resources" },
  { href: "/case-studies", label: "Case studies" },
] as const;

const ROLES = [
  { href: "/services", label: "All services" },
  { href: "/services#customer-support", label: "Customer support" },
  { href: "/services#it-support", label: "IT support" },
  { href: "/services#marketing", label: "Marketing" },
  { href: "/services#customer-relations", label: "Customer relations" },
  { href: "/services#virtual-assistants", label: "Virtual assistants" },
] as const;

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

const SOCIALS = [
  { href: BRAND.sameAs[0], label: "LinkedIn", icon: IconBrandLinkedin },
  { href: BRAND.sameAs[1], label: "Facebook", icon: IconBrandFacebook },
  { href: BRAND.sameAs[2], label: "Instagram", icon: IconBrandInstagram },
  { href: BRAND.sameAs[3], label: "YouTube", icon: IconBrandYoutube },
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-strong/45 focus-visible:ring-offset-2";

const navyFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy";

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="font-display text-sm font-semibold text-navy">{title}</p>
      <ul className="mt-3">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <Link
              href={link.href}
              className={cn(
                "inline-flex min-h-11 items-center text-sm text-slate transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-green-strong",
                focusRing,
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      data-site-footer
      className="relative overflow-x-clip border-t border-line bg-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-0 size-[16rem] rounded-full bg-soft-green blur-[90px]"
      />

      <Container className="relative pt-10 pb-12 sm:pt-12 sm:pb-14">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="max-w-sm lg:col-span-5">
            <Link
              href="/"
              className={cn(
                "inline-flex min-h-11 items-center rounded-[4px]",
                focusRing,
              )}
              aria-label={`${BRAND.displayName} home`}
            >
              <Image
                src={BRAND.logoUrl}
                alt=""
                width={160}
                height={50}
                className="h-8 w-auto object-contain object-left sm:h-9"
              />
            </Link>
            <p className="mt-4 font-display text-xl font-bold leading-tight tracking-tight text-navy sm:text-2xl">
              Search. Place.{" "}
              <span className="text-green-strong">Pay.</span>
            </p>
            <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-pretty text-slate sm:text-base">
              BPO teams for support, ops, and virtual assistants. You keep the
              work.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/contact"
                data-analytics="footer_cta"
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
            </div>
            <ul className="mt-6 flex items-center gap-2">
              {SOCIALS.map((social) => {
                const Icon = social.icon;
                return (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-full border border-line text-navy transition-[transform,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:border-green [@media(hover:hover)_and_(pointer:fine)]:hover:bg-soft-green [@media(hover:hover)_and_(pointer:fine)]:hover:text-green-strong",
                        focusRing,
                      )}
                    >
                      <Icon stroke={1.75} className="size-5" aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8 sm:gap-10 lg:col-span-5 lg:col-start-8 lg:pt-1"
          >
            <FooterLinks title="Explore" links={EXPLORE} />
            <FooterLinks title="Roles" links={ROLES} />
          </nav>
        </div>
      </Container>

      <div className="bg-navy">
        <Container className="flex flex-col gap-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
            <p className="text-sm text-white/80">
              &copy; {year} {SITE.legalName}. All rights reserved.
            </p>
            <ul className="flex items-center gap-4">
              {LEGAL.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "inline-flex min-h-11 items-center text-sm text-white/80 transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white",
                      navyFocusRing,
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="font-display text-sm font-semibold text-lime">
            People power better business
          </p>
        </Container>
      </div>
    </footer>
  );
}
