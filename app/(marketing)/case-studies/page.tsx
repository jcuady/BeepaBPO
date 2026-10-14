import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { BreadcrumbJsonLd } from "@/components/marketing/breadcrumb-json-ld";

export const metadata: Metadata = {
  title: "Case Studies",
  // Was 37 characters — roughly half the space Google gives before it truncates,
  // so it rendered as a stub next to every competitor listing. Descriptions are
  // the cheapest CTR lever on the page and this one was left nearly empty.
  description:
    "Real outcomes from teams built with Beepa BPO — client, industry and the measurable result, from support coverage to payroll accuracy.",
  alternates: { canonical: "/case-studies" },
};

export default async function CaseStudiesPage() {
  const supabase = await createClient();
  const { data: studies } = await supabase
    .from("case_studies")
    .select("id, title, slug, summary, client_name, industry, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <section className="bg-white py-20 md:py-28">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Case studies", path: "/case-studies" },
        ]}
      />
      <Container className="max-w-3xl">
        <SectionHeading as="h1">Case studies</SectionHeading>
        <p className="mt-6 text-base leading-relaxed text-slate">
          Real outcomes from partners who built teams with Beepa.
        </p>

        <div className="mt-10 space-y-8">
          {!studies?.length ? (
            <p className="text-sm text-slate">
              Case studies will appear here when published.{" "}
              <Link
                href="/contact"
                className="text-green-strong hover:underline"
              >
                Talk with us
              </Link>{" "}
              about your next hire.
            </p>
          ) : (
            studies.map((study) => (
              <article key={study.id} className="border-b border-line pb-8">
                <h2 className="font-display text-xl font-semibold text-navy">
                  <Link
                    href={`/case-studies/${study.slug}`}
                    className="hover:text-green-strong"
                  >
                    {study.title}
                  </Link>
                </h2>
                <p className="mt-1 text-base text-slate md:text-sm">
                  {[study.client_name, study.industry].filter(Boolean).join(" · ")}
                </p>
                {study.summary ? (
                  <p className="mt-2 line-clamp-3 text-base leading-relaxed text-slate">
                    {study.summary}
                  </p>
                ) : null}
                <Link
                  href={`/case-studies/${study.slug}`}
                  // `inline-flex min-h-11` gives the card CTA a 44px touch
                  // target. As a bare text link it measured 111x20 on every
                  // phone and tablet viewport, which fails WCAG 2.5.5 — and this
                  // is a standalone action, not a link flowing inside a
                  // sentence, so the inline-prose exemption does not apply.
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
                >
                  Read case study
                </Link>
              </article>
            ))
          )}
        </div>

        <Button
          className="mt-10"
          nativeButton={false}
          render={<Link href="/contact" />}
        >
          Build Your Team
        </Button>
      </Container>
    </section>
  );
}
