import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";

export const metadata: Metadata = {
  title: "Resources",
  description: "Practical insights for teams building with Beepa.",
  alternates: { canonical: "/resources" },
};

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <section className="bg-white py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading as="h1">Resources</SectionHeading>
        <p className="mt-6 text-base leading-relaxed text-slate">
          Practical insights for teams building with Beepa.{" "}
          <Link href="/case-studies" className="text-green-strong hover:underline">
            Browse case studies
          </Link>
          .
        </p>

        <div className="mt-10 space-y-8">
          {!posts?.length ? (
            <p className="text-sm text-slate">
              No articles published yet.{" "}
              <Link
                href="/contact"
                className="text-green-strong hover:underline"
              >
                Talk with us
              </Link>{" "}
              about your next hire in the meantime.
            </p>
          ) : (
            posts.map((post) => (
              <article key={post.id} className="border-b border-line pb-8">
                <p className="text-xs font-medium uppercase tracking-wide text-slate">
                  {post.published_at
                    ? format(new Date(post.published_at), "MMMM d, yyyy")
                    : null}
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold text-navy">
                  <Link
                    href={`/resources/${post.slug}`}
                    className="hover:text-green-strong"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-3 text-base leading-relaxed text-slate">
                    {post.excerpt}
                  </p>
                ) : null}
                <Link
                  href={`/resources/${post.slug}`}
                  className="mt-3 inline-block text-sm font-medium text-green-strong hover:underline"
                >
                  Read article
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
