import type { Metadata } from "next";
import { CareersBand } from "@/components/marketing/careers-band";
import { FAQSection, FAQ_ITEMS } from "@/components/marketing/faq-section";
import { FinalCTA } from "@/components/marketing/final-cta";
import { HeroSection } from "@/components/marketing/hero-section";
import { ManpowerModelSection } from "@/components/marketing/manpower-model-section";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { ServicesSection } from "@/components/marketing/services-section";
import { TrustedBySection } from "@/components/marketing/trusted-by-section";
import { WhyBeepaSection } from "@/components/marketing/why-beepa-section";
import { BRAND } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: {
    absolute: BRAND.title,
  },
  description: BRAND.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: BRAND.title,
    description: BRAND.description,
    url: BRAND.url,
    images: [
      {
        url: BRAND.ogImageUrl,
        width: 1672,
        height: 941,
        alt: `${BRAND.name} — ${BRAND.tagline}`,
      },
    ],
  },
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: cmsFaqs } = await supabase
    .from("faqs")
    .select("question, answer")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(12);

  const faqItems =
    cmsFaqs && cmsFaqs.length > 0
      ? cmsFaqs.map((f) => ({ q: f.question, a: f.answer }))
      : FAQ_ITEMS;

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${BRAND.url}/#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    alternateName: [BRAND.displayName, BRAND.legalName, "BeePA"],
    url: BRAND.url,
    logo: {
      "@type": "ImageObject",
      url: `${BRAND.url}${BRAND.iconUrl}`,
      width: 512,
      height: 512,
    },
    image: `${BRAND.url}${BRAND.ogImageUrl}`,
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
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: BRAND.email,
      url: `${BRAND.url}/contact`,
      availableLanguage: ["English"],
    },
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BRAND.url}/#website`,
    name: BRAND.name,
    url: BRAND.url,
    description: BRAND.description,
    publisher: { "@id": `${BRAND.url}/#organization` },
    inLanguage: "en-US",
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HeroSection />
      <TrustedBySection />
      <ServicesSection />
      <WhyBeepaSection />
      <ProofStrip />
      <CareersBand />
      <ManpowerModelSection />
      <FAQSection items={faqItems} />
      <FinalCTA />
    </>
  );
}
