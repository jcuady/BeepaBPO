import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Customer support, back office, virtual assistants, sales support, and specialized outsourcing.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, title, slug, summary, description")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(50);

  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading as="h1">
          Outsourcing solutions for a stronger tomorrow.
        </SectionHeading>
        <p className="mt-6 text-base leading-relaxed text-slate">
          Dedicated teams for the roles and outcomes your business needs.
        </p>

        <div className="mt-10 space-y-8">
          {!services?.length ? (
            <p className="text-sm text-slate">
              Service pages are being prepared.{" "}
              <Link
                href="/contact"
                className="text-green-strong hover:underline"
              >
                Start a conversation
              </Link>{" "}
              about the roles you need.
            </p>
          ) : (
            services.map((service) => (
              <article
                key={service.id}
                id={service.slug}
                className="border-b border-line pb-8"
              >
                <h2 className="font-display text-xl font-semibold text-navy">
                  {service.title}
                </h2>
                {service.summary ? (
                  <p className="mt-2 text-base leading-relaxed text-slate">
                    {service.summary}
                  </p>
                ) : null}
                {service.description ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate">
                    {service.description}
                  </p>
                ) : null}
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
