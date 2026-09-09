import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND.cta} — Start Your BPO Team`,
  description: `Tell ${BRAND.displayName} what your business needs. Share roles, timing, and goals — we'll follow up to start discovery for your outsourced team.`,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `${BRAND.cta} — Start Your BPO Team | ${BRAND.name}`,
    description: `Share roles, timing, and goals. ${BRAND.displayName} follows up to start discovery for your outsourced team.`,
  },
};

const TRUST = [
  "People-first hiring",
  "Secure operations",
  "Teams that scale with you",
] as const;

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
      <section className="relative overflow-hidden bg-mist/50 py-16 md:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-0 size-[320px] rounded-full bg-green/10 blur-[100px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 bottom-0 size-[280px] rounded-full bg-lime/15 blur-[90px]"
        />
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                {BRAND.cta}
              </p>
              <SectionHeading
                as="h1"
                className="mt-4 text-[clamp(2rem,4vw,3rem)]"
              >
                Tell us what your team needs.
              </SectionHeading>
              <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-slate">
                A short, guided request — who you are, your company, and what
                you need. {BRAND.displayName} follows up to start discovery.
              </p>
              <ul className="mt-8 space-y-3">
                {TRUST.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm font-medium text-navy"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full bg-lime"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-sm text-slate">
                Prefer email?{" "}
                <a
                  href={`mailto:${BRAND.email}`}
                  className="font-semibold text-green-strong underline-offset-2 hover:underline"
                >
                  {BRAND.email}
                </a>
              </p>
            </div>
            <ContactForm />
          </div>
        </Container>
      </section>

      {faqs?.length ? (
        <section className="border-t border-line bg-white py-16 md:py-20">
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
