export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/why-beepa", label: "Why Beepa" },
  { href: "/careers", label: "Careers" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
] as const;

/** Public brand used in browser tabs, SERPs, and Search Console. */
export const BRAND = {
  /** Short product / search brand */
  name: "BeepoBPO",
  /** Legal / footer entity */
  legalName: "Beepa BPO",
  /** Marketing wordmark */
  displayName: "Beepa",
  tagline: "People. Process. Progress.",
  cta: "Let's Talk",
  /**
   * SERP title (~50–60 chars). Keyword near front + brand.
   * Keep under 60 for desktop SERPs.
   */
  title: "BeepoBPO | People-First BPO Outsourcing Partner",
  /**
   * Meta description (~150–160 chars) with value + CTA.
   */
  description:
    "BeepoBPO is a people-first BPO partner for dependable support, ops, and talent teams. Scale with confidence — tell us what you need.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://beepabpo.com",
  /** Square mark for Google favicon / Knowledge Panel */
  iconUrl: "/brand/icon-512.png",
  /** Horizontal logo for headers / Organization.logo alternate */
  logoUrl: "/brand/beepa-logo-horizontal.png",
  ogImageUrl: "/images/og.png",
  email: "hello@beepabpo.com",
  sameAs: [
    "https://www.linkedin.com/company/beepa",
    "https://www.facebook.com/beepa",
    "https://www.instagram.com/beepa",
    "https://www.youtube.com/@beepa",
  ] as const,
} as const;

/** @deprecated Prefer BRAND — kept for existing imports */
export const SITE = {
  name: BRAND.displayName,
  legalName: BRAND.legalName,
  tagline: BRAND.tagline,
  cta: BRAND.cta,
  description: BRAND.description,
  url: BRAND.url,
} as const;
