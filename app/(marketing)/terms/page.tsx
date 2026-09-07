import type { Metadata } from "next";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing use of Beepa BPO websites and related services.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading as="h1">Terms of Service</SectionHeading>
        <p className="mt-6 text-sm text-slate">Last updated: September 5, 2026</p>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-slate">
          <p>
            By using {SITE.legalName} websites and related services, you agree
            to these terms.
          </p>
          <h2 className="font-display text-xl font-semibold text-navy">
            Accounts
          </h2>
          <p>
            You are responsible for keeping your login credentials secure.
            Privileged Beepa system access is granted only through invitation
            and approval. Creating an account does not grant employee, client
            admin, or other privileged roles.
          </p>
          <h2 className="font-display text-xl font-semibold text-navy">
            Acceptable use
          </h2>
          <p>
            Do not misuse the site, attempt unauthorized access, or submit
            unlawful content. We may suspend access that threatens security or
            service integrity.
          </p>
          <h2 className="font-display text-xl font-semibold text-navy">
            Contact
          </h2>
          <p>
            Questions about these terms can be sent through the{" "}
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
