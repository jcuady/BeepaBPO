export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/#why-beepa", label: "Why Beepa" },
  { href: "/careers", label: "Careers" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
] as const;

export const SITE = {
  name: "Beepa",
  legalName: "Beepa BPO",
  tagline: "People. Process. Progress.",
  cta: "Let's Talk",
  description:
    "Beepa is a people-first outsourcing partner helping businesses build dependable teams and grow with confidence.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://beepabpo.com",
} as const;
