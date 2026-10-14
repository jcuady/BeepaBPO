import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";
import { pageMetadata, clampDescription } from "@/lib/seo/metadata";
import { JsonLd, articleJsonLd } from "@/lib/seo/json-ld";

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

  // Dropped the ` — Case Studies` suffix for the same reason as resources: the
  // root layout's title template already appends the brand, and the combination
  // produced 90-character titles.
  return pageMetadata({
    title: study.title,
    description: study.summary || study.body,
    path: `/case-studies/${slug}`,
    type: "article",
  });
}

export default async function CaseStudyDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: study } = await supabase
    .from("case_studies")
    .select("title, summary, body, client_name, industry, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!study) notFound();

  return (
    <section className="bg-white py-16 md:py-24">
      <JsonLd
        data={articleJsonLd({
          headline: study.title,
          description: clampDescription(study.summary || study.body),
          path: `/case-studies/${slug}`,
          datePublished: study.published_at,
          section: "Case studies",
        })}
      />
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
