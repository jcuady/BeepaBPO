import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: study } = await supabase
    .from("case_studies")
    .select("title, summary, body")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!study) return { title: "Case Studies" };

  return {
    title: `${study.title} — Case Studies`,
    description: (study.summary || study.body).slice(0, 160),
    alternates: { canonical: `/case-studies/${slug}` },
  };
}

export default async function CaseStudyDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: study } = await supabase
    .from("case_studies")
    .select("title, summary, body, client_name, industry")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!study) notFound();

  return (
    <section className="bg-white py-16 md:py-24">
      <Container className="max-w-3xl">
        <Link
          href="/case-studies"
          className="text-sm font-medium text-green-strong hover:underline"
        >
          ← All case studies
        </Link>

        <h1 className="mt-6 font-display text-3xl font-bold text-navy">
          {study.title}
        </h1>
        <p className="mt-2 text-slate">
          {[study.client_name, study.industry].filter(Boolean).join(" · ")}
        </p>
        {study.summary ? (
          <p className="mt-4 text-lg leading-relaxed text-slate">
            {study.summary}
          </p>
        ) : null}

        <div className="mt-10 whitespace-pre-wrap text-base leading-relaxed text-slate">
          {study.body}
        </div>
      </Container>
    </section>
  );
}
