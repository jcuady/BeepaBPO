import Image from "next/image";
import Link from "next/link";
import {
  IconBrandLinkedin,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandYoutube,
} from "@tabler/icons-react";
import { Container } from "@/components/beepa/container";
import { SITE } from "@/lib/site";

const FOOTER_COLS = [
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/#why-beepa", label: "Why Beepa" },
      { href: "/careers", label: "Careers" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Services",
    links: [
      { href: "/services", label: "All services" },
      { href: "/services", label: "Customer Support" },
      { href: "/services", label: "Back Office" },
      { href: "/services", label: "Virtual Assistants" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

const SOCIALS = [
  { href: "https://linkedin.com", label: "LinkedIn", icon: IconBrandLinkedin },
  { href: "https://facebook.com", label: "Facebook", icon: IconBrandFacebook },
  {
    href: "https://instagram.com",
    label: "Instagram",
    icon: IconBrandInstagram,
  },
  { href: "https://youtube.com", label: "YouTube", icon: IconBrandYoutube },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-white">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm space-y-5">
            <Image
              src="/brand/beepa-logo-alt.png"
              alt="BEEPA"
              width={120}
              height={120}
              className="h-16 w-auto object-contain object-left"
            />
            <p className="text-sm leading-relaxed text-slate">
              A people-first outsourcing partner helping businesses build
              dependable teams and grow with confidence.
            </p>
            <ul className="flex items-center gap-2">
              {SOCIALS.map((social) => {
                const Icon = social.icon;
                return (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-navy transition-colors hover:border-green hover:bg-soft-green hover:text-green-strong"
                    >
                      <Icon stroke={1.75} className="size-5" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <p className="font-display text-sm font-semibold text-navy">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-1">
                  {col.links.map((link) => (
                    <li key={`${col.title}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 text-sm text-slate transition-colors hover:text-green-strong"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Container>

      <div className="bg-navy">
        <Container className="flex flex-col items-center gap-3 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-white/70">
            &copy; {year} {SITE.legalName}. All rights reserved.
          </p>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-lime">
            People power better business
          </p>
        </Container>
      </div>
    </footer>
  );
}
