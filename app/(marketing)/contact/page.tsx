import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Let's Talk — Start Your BPO Team",
  description:
    "Tell BeepoBPO what your business needs. Share roles, timing, and goals — we'll follow up to start discovery for your outsourced team.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Let's Talk — Start Your BPO Team | BeepoBPO",
    description:
      "Share roles, timing, and goals. BeepoBPO follows up to start discovery for your outsourced team.",
  },
};

export default async function ContactPage() {
  const supabase = await createClient();
  const { data: faqs } = await supabase
    .from("faqs")
    .select("id, question, answer, category")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(20);

  return (
    <>
      <section className="bg-white py-16 md:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                Better Teams. Stronger Businesses.
              </p>
              <SectionHeading
                as="h1"
                className="mt-4 text-[clamp(2rem,4vw,3rem)]"
              >
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

      {faqs?.length ? (
        <section className="border-t border-line bg-mist/40 py-16 md:py-20">
          <Container className="max-w-3xl">
            <SectionHeading as="h2">Common questions</SectionHeading>
            <p className="mt-3 text-base text-slate">
              Quick answers while you decide how to reach out.
            </p>
            <div className="mt-10 space-y-6">
              {faqs.map((faq) => (
                <article key={faq.id} className="border-b border-line pb-6">
                  <h3 className="font-display text-lg font-semibold text-navy">
                    {faq.question}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-slate">
                    {faq.answer}
                  </p>
                </article>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
