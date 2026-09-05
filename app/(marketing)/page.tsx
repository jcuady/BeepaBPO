import type { Metadata } from "next";
import { CareersBand } from "@/components/marketing/careers-band";
import { FAQSection, FAQ_ITEMS } from "@/components/marketing/faq-section";
import { FinalCTA } from "@/components/marketing/final-cta";
import { HeroSection } from "@/components/marketing/hero-section";
import { ProcessTimeline } from "@/components/marketing/process-timeline";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { ServicesSection } from "@/components/marketing/services-section";
import { TrustedBySection } from "@/components/marketing/trusted-by-section";
import { WhyBeepaSection } from "@/components/marketing/why-beepa-section";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "People-first outsourcing partner",
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: SITE.legalName,
    url: SITE.url,
    description: SITE.description,
    slogan: SITE.tagline,
    foundingDate: "2019",
    areaServed: "Worldwide",
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HeroSection />
      <TrustedBySection />
      <ServicesSection />
      <WhyBeepaSection />
      <ProofStrip />
      <CareersBand />
      <ProcessTimeline />
      <FAQSection />
      <FinalCTA />
    </>
  );
}
