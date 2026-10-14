import { SERVICES_CATALOG } from "@/lib/marketing/services-catalog";
import { BRAND } from "@/lib/site";

type BreadcrumbItem = { name: string; path: string };

export function organizationJsonLd() {
  const logoUrl = `${BRAND.url}${BRAND.googleLogoUrl}`;
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    "@id": `${BRAND.url}/#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    alternateName: [BRAND.displayName, BRAND.legalName, "BeePA", "Beepo BPO"],
    url: BRAND.url,
    logo: {
      "@type": "ImageObject",
      "@id": `${BRAND.url}/#logo`,
      url: logoUrl,
      contentUrl: logoUrl,
      width: 512,
      height: 512,
      caption: BRAND.name,
      inLanguage: "en-US",
    },
    image: [
      logoUrl,
      `${BRAND.url}${BRAND.iconUrl}`,
      `${BRAND.url}${BRAND.ogImageUrl}`,
    ],
    description: BRAND.description,
    slogan: BRAND.tagline,
    foundingDate: "2019",
    areaServed: "Worldwide",
    email: BRAND.email,
    sameAs: [...BRAND.sameAs],
    knowsAbout: [
      "Business process outsourcing",
      "Customer support",
      "Back-office operations",
      "Recruitment process outsourcing",
      "Virtual assistants",
      "Manpower staffing",
      "IT support outsourcing",
      "Marketing support staffing",
      "eLearning course development",
      "Presentation design staffing",
      "Data entry outsourcing",
      "Customer relations staffing",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: BRAND.email,
      url: `${BRAND.url}/contact`,
      availableLanguage: ["English"],
    },
  };
}

export function servicesItemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "BeepoBPO outsourcing services",
    itemListElement: SERVICES_CATALOG.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: `${BRAND.url}/services#${item.slug}`,
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BRAND.url}/#website`,
    name: BRAND.name,
    url: BRAND.url,
    description: BRAND.description,
    publisher: { "@id": `${BRAND.url}/#organization` },
    inLanguage: "en-US",
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${BRAND.url}${item.path === "/" ? "" : item.path}`,
    })),
  };
}

export function jobPostingJsonLd(input: {
  title: string;
  description: string;
  slug: string;
  datePosted?: string | null;
  employmentType?: string | null;
  locationType?: string | null;
}) {
  const employmentMap: Record<string, string> = {
    full_time: "FULL_TIME",
    part_time: "PART_TIME",
    contract: "CONTRACTOR",
    temporary: "TEMPORARY",
    internship: "INTERN",
  };

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: input.title,
    description: input.description,
    datePosted: input.datePosted ?? undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: BRAND.name,
      sameAs: BRAND.url,
      logo: `${BRAND.url}${BRAND.iconUrl}`,
    },
    identifier: {
      "@type": "PropertyValue",
      name: BRAND.name,
      value: input.slug,
    },
    employmentType: input.employmentType
      ? employmentMap[input.employmentType] ?? "FULL_TIME"
      : "FULL_TIME",
    jobLocationType:
      input.locationType === "remote" ? "TELECOMMUTE" : undefined,
    url: `${BRAND.url}/careers/${input.slug}`,
    directApply: true,
  };
}

/**
 * `Article` for the editorial routes (resources, case studies).
 *
 * These pages had no structured data at all, so they could not qualify for
 * article or breadcrumb rich results despite carrying a publish date, an author
 * and a real body. `datePublished` is required for an Article to validate — it
 * is optional in the helper only because a not-yet-dated draft is a legitimate
 * state for a CMS record, and omitting the key is valid; publishing a null one
 * is not.
 */
export function articleJsonLd(input: {
  headline: string;
  description: string;
  path: string;
  datePublished?: string | null;
  dateModified?: string | null;
  authorName?: string;
  section?: string;
  wordCount?: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${BRAND.url}${input.path}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BRAND.url}${input.path}` },
    headline: input.headline,
    description: input.description,
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    author: {
      "@type": "Organization",
      name: input.authorName ?? BRAND.name,
      url: BRAND.url,
      logo: `${BRAND.url}${BRAND.iconUrl}`,
    },
    publisher: { "@id": `${BRAND.url}/#organization` },
    image: [`${BRAND.url}${BRAND.ogImageUrl}`],
    inLanguage: "en-US",
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> | object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
