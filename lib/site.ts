import { resolveSiteUrl } from "@/lib/site-url";

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
  /**
   * Short product / search brand.
   *
   * This read "BeepoBPO" until 2026-10-19 and it is what Google was serving:
   * the homepage title came back as "BeepoBPO | People-First BPO Outsourcing
   * Partner". Every other surface already said "Beepa BPO" -- the legal name,
   * the footer, the privacy and terms pages, the payslip footer -- so the SERP
   * was the single odd spelling and it was the one users see first. It is
   * driven by the title template `%s | ${BRAND.name}`, so it also suffixed
   * every page title on the site.
   *
   * The repo and the old `BeepoBPO` string are kept as an alternate below so
   * existing search traffic and any bookmarked query for the old spelling still
   * resolves rather than 404ing on a brand change.
   */
  name: "Beepa BPO",
  /** Legal / footer entity */
  legalName: "Beepa BPO",
  /** Marketing wordmark */
  displayName: "Beepa",
  /** Previously-served brand string. Kept for redirects and copy, never displayed. */
  formerName: "BeepoBPO",
  /** Alternate spellings folded into /careers and the site search. */
  alternateNames: ["BeepoBPO", "Beepa BPO", "Beepa"] as const,
  tagline: "People. Process. Progress.",
  cta: "Let's Talk",
  /**
   * SERP title (~50–60 chars). Keyword near front + brand.
   * Keep under 60 for desktop SERPs.
   *
   * The brand rename cost four characters — "BeepoBPO" was one word and
   * "Beepa BPO" is two — and the old string was already at 59. Adding
   * "Outsourcing" to the end instead of "Outsourcing Partner" is what keeps it
   * at 55 and still reads as a sentence; the "partner" framing lives in the
   * description, which has room for it.
   */
  title: "Beepa BPO | People-First Outsourcing in the Philippines",
  /**
   * Meta description (~150–160 chars) with value + CTA.
   */
  description:
    "Beepa BPO is a people-first outsourcing partner in the Philippines for customer support, operations and offshore teams. Tell us what you need.",
  url: resolveSiteUrl(),
  /**
   * Square mark for favicon / PWA.
   *
   * Generated from `public/brand/logo-mark-raw.png` by
   * `scripts/generate-brand-icons.mjs`; this was a navy tile carrying a
   * hand-drawn approximation that did not match the real mark.
   */
  iconUrl: "/brand/icon-512.png",
  /**
   * Organization.logo for Google Search / Knowledge Panel.
   * White background — required so the mark reads on Google's white surfaces.
   */
  googleLogoUrl: "/brand/google-organization-logo.png",
  /** Horizontal logo for headers */
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
