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

export function JsonLd({ data }: { data: Record<string, unknown> | object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
