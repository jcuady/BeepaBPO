import type { Metadata } from "next";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Beepa BPO collects, uses, and protects personal information on our websites and services.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="prose-beepa max-w-3xl">
        <SectionHeading as="h1">Privacy Policy</SectionHeading>
        <p className="mt-6 text-sm text-slate">Last updated: September 5, 2026</p>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-slate">
          <p>
            {SITE.legalName} (&quot;Beepa&quot;, &quot;we&quot;, &quot;us&quot;)
            respects your privacy. This page explains what information we collect
            on beepabpo.com and how we use it.
          </p>
          <h2 className="font-display text-xl font-semibold text-navy">
            Information we collect
          </h2>
          <p>
            When you contact us or create an account, we collect the details you
            submit such as name, email, company, and message content. We may also
            collect basic technical data such as IP address and browser type for
            security and reliability.
          </p>
          <h2 className="font-display text-xl font-semibold text-navy">
            How we use information
          </h2>
          <p>
            We use this information to respond to inquiries, operate accounts,
            improve the website, and meet legal obligations. We do not sell your
            personal information.
          </p>
          <h2 className="font-display text-xl font-semibold text-navy">
            Contact
          </h2>
          <p>
            For privacy questions, contact us through the{" "}
            <a href="/contact" className="font-semibold text-green-strong hover:underline">
              contact form
            </a>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
