import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";
import { pageMetadata, clampDescription } from "@/lib/seo/metadata";
import { JsonLd, articleJsonLd } from "@/lib/seo/json-ld";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, body")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!post) return { title: "Resources" };

  // The title used to be `${post.title} — Resources`, which the root layout's
  // `%s | ${BRAND.name}` template then suffixed again. The two together shipped
  // 84-character titles that Google truncates mid-word. The brand is already in
  // the template; the page needs only its own name.
  return pageMetadata({
    title: post.title,
    description: post.excerpt || post.body,
    path: `/resources/${slug}`,
    type: "article",
  });
}

export default async function ResourceArticlePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, body, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!post) notFound();

  return (
    <section className="bg-white py-16 md:py-24">
      <JsonLd
        data={articleJsonLd({
          headline: post.title,
          description: clampDescription(post.excerpt || post.body),
          path: `/resources/${slug}`,
          datePublished: post.published_at,
          section: "Resources",
        })}
      />
      <Container className="max-w-3xl">
        <Link
          href="/resources"
          className="text-sm font-medium text-green-strong hover:underline"
        >
          ← All resources
        </Link>

        <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate">
          {post.published_at
            ? format(new Date(post.published_at), "MMMM d, yyyy")
            : null}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-navy">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="mt-4 text-lg leading-relaxed text-slate">
            {post.excerpt}
          </p>
        ) : null}

        <div className="mt-10 whitespace-pre-wrap text-base leading-relaxed text-slate">
          {post.body}
        </div>
      </Container>
    </section>
  );
}
