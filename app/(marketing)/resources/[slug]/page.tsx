import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";

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

  return {
    title: `${post.title} — Resources`,
    description: (post.excerpt || post.body).slice(0, 160),
    alternates: { canonical: `/resources/${slug}` },
  };
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
