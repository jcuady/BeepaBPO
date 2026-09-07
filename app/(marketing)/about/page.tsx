import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ABOUT_SETTING_KEY, parseAboutSetting } from "@/lib/cms/about";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export const metadata: Metadata = {
  title: "About",
  description:
    "Beepa began in 2019 with a purpose that grew into a people-first outsourcing partner.",
  alternates: { canonical: "/about" },
};

const FALLBACK = {
  headline: "Built on Purpose. Growing Together.",
  body: "Beepa is a people-first outsourcing partner founded in 2019. We help businesses build dependable teams with care for people and outcomes.",
};

export default async function AboutPage() {
  const supabase = await createClient();
  const [{ data: aboutRow }, { data: industries }, { data: testimonials }] =
    await Promise.all([
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", ABOUT_SETTING_KEY)
        .maybeSingle(),
      supabase
        .from("industries")
        .select("id, name, description")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .limit(24),
      supabase
        .from("testimonials")
        .select("id, client_name, client_title, company_name, quote, rating")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .limit(12),
    ]);

  const about = parseAboutSetting(aboutRow?.value) ?? FALLBACK;

  return (
    <>
      <section className="bg-white py-20 md:py-28">
        <Container className="max-w-3xl">
          <SectionHeading as="h1">{about.headline}</SectionHeading>
          <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-slate">
            {about.body}
          </p>
          <Button
            className="mt-8"
            nativeButton={false}
            render={<Link href="/contact" />}
          >
            Build Your Team
          </Button>
        </Container>
      </section>

      {industries?.length ? (
        <section className="border-t border-line bg-mist/40 py-16 md:py-20">
          <Container className="max-w-3xl">
            <SectionHeading as="h2">Industries we serve</SectionHeading>
            <p className="mt-3 text-base text-slate">
              Teams tailored to the realities of your sector.
            </p>
            <div className="mt-10 space-y-6">
              {industries.map((item) => (
                <article key={item.id} className="border-b border-line pb-6">
                  <h3 className="font-display text-lg font-semibold text-navy">
                    {item.name}
                  </h3>
                  {item.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-slate">
                      {item.description}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {testimonials?.length ? (
        <section className="border-t border-line bg-white py-16 md:py-20">
          <Container className="max-w-3xl">
            <SectionHeading as="h2">What partners say</SectionHeading>
            <div className="mt-10 space-y-8">
              {testimonials.map((item) => (
                <blockquote
                  key={item.id}
                  className="border-b border-line pb-8 last:border-0"
                >
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-navy">
                    “{item.quote}”
                  </p>
                  <footer className="mt-3 text-sm text-slate">
                    <span className="font-medium text-navy">
                      {item.client_name}
                    </span>
                    {item.client_title ? `, ${item.client_title}` : ""}
                    {item.company_name ? ` · ${item.company_name}` : ""}
                    {item.rating != null ? ` · ${item.rating}/5` : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
