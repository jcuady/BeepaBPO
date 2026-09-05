import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export const metadata: Metadata = {
  title: "Let's Talk",
  description:
    "Tell Beepa what your business needs. We help you build a dependable outsourced team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <section className="bg-white py-16 md:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
              Better Teams. Stronger Businesses.
            </p>
            <SectionHeading as="h1" className="mt-4 text-[clamp(2rem,4vw,3rem)]">
              Tell us what your team needs.
            </SectionHeading>
            <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-slate">
              Share a short note about roles, timing, or the support you need.
              Our team will follow up to start discovery.
            </p>
          </div>
          <ContactForm />
        </div>
      </Container>
    </section>
  );
}
