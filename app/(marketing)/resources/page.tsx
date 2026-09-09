import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import {
  IconArrowRight,
  IconBook2,
  IconFileDescription,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/beepa/container";
import { SectionHeading } from "@/components/beepa/section-heading";
import { FinalCTA } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/site";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Practical notes on staffing, payroll-backed teams, and working with Beepa.",
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

  const [featured, ...rest] = posts ?? [];

  return (
    <>
      <PageHero
        eyebrow="Resources"
        title="Practical notes for teams that need people."
        description={
          <>
            Insights on staffing, payroll-backed teams, and how{" "}
            {BRAND.displayName} works with growing businesses — plus case
            studies from the field.
          </>
        }
        cta={{ href: "/case-studies", label: "Browse case studies" }}
        secondaryCta={{ href: "/contact", label: "Talk with us" }}
      />

      <section className="bg-white py-20 md:py-28">
        <Container>
          {!posts?.length ? (
            <div className="grid gap-8 lg:grid-cols-12">
              <div className="rounded-[28px] bg-mist p-8 ring-1 ring-line lg:col-span-7 md:p-10">
                <span className="flex size-12 items-center justify-center rounded-[14px] bg-white text-green-strong ring-1 ring-line">
                  <IconBook2 stroke={1.5} className="size-6" aria-hidden />
                </span>
                <SectionHeading as="h2" className="mt-6">
                  Articles are on the way
                </SectionHeading>
                <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-slate">
                  We are drafting field notes on hiring remote talent, managing
                  payroll-backed teams, and briefing roles clearly. Meanwhile,
                  talk with us about the roles you need filled.
                </p>
                <Button
                  className="group mt-8 min-h-11 gap-2 rounded-full bg-green-strong text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green active:scale-[0.97]"
                  nativeButton={false}
                  render={<Link href="/contact" />}
                >
                  Request talent
                  <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
                    <IconArrowRight stroke={2} className="size-3" aria-hidden />
                  </span>
                </Button>
              </div>
              <aside className="flex flex-col justify-between rounded-[28px] bg-navy p-8 text-white lg:col-span-5 md:p-10">
                <div>
                  <IconFileDescription
                    stroke={1.5}
                    className="size-7 text-lime"
                    aria-hidden
                  />
                  <h3 className="mt-5 font-display text-xl font-bold text-white">
                    Prefer a live brief?
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-white/70">
                    Share the roles, skills, and schedule you need. We start the
                    search from there.
                  </p>
                </div>
                <Link
                  href="/case-studies"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-lime underline-offset-4 hover:underline"
                >
                  See case studies
                  <IconArrowRight stroke={2} className="size-3.5" aria-hidden />
                </Link>
              </aside>
            </div>
          ) : (
            <>
              {featured ? (
                <article className="grid gap-8 border-b border-line pb-14 lg:grid-cols-12 lg:gap-12">
                  <div className="lg:col-span-7">
                    <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
                      Featured
                    </p>
                    <h2 className="mt-3 font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold tracking-tight text-navy text-balance">
                      <Link
                        href={`/resources/${featured.slug}`}
                        className="transition-colors duration-200 hover:text-green-strong"
                      >
                        {featured.title}
                      </Link>
                    </h2>
                    {featured.published_at ? (
                      <p className="mt-3 text-sm text-slate">
                        {format(new Date(featured.published_at), "MMMM d, yyyy")}
                      </p>
                    ) : null}
                    {featured.excerpt ? (
                      <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-slate">
                        {featured.excerpt}
                      </p>
                    ) : null}
                    <Link
                      href={`/resources/${featured.slug}`}
                      className="group mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-medium text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-green-strong active:scale-[0.97]"
                    >
                      Read article
                      <IconArrowRight
                        stroke={2}
                        className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </div>
                  <div className="hidden rounded-[28px] bg-mist ring-1 ring-line lg:col-span-5 lg:block lg:min-h-[240px]" />
                </article>
              ) : null}

              {rest.length ? (
                <div className="mt-14">
                  <SectionHeading as="h2">More reading</SectionHeading>
                  <ul className="mt-8 divide-y divide-line">
                    {rest.map((post) => (
                      <li key={post.id} className="py-8 first:pt-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate">
                          {post.published_at
                            ? format(new Date(post.published_at), "MMMM d, yyyy")
                            : null}
                        </p>
                        <h3 className="mt-2 font-display text-xl font-semibold text-navy">
                          <Link
                            href={`/resources/${post.slug}`}
                            className="transition-colors duration-200 hover:text-green-strong"
                          >
                            {post.title}
                          </Link>
                        </h3>
                        {post.excerpt ? (
                          <p className="mt-2 max-w-[60ch] line-clamp-2 text-base leading-relaxed text-slate">
                            {post.excerpt}
                          </p>
                        ) : null}
                        <Link
                          href={`/resources/${post.slug}`}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-strong underline-offset-4 hover:underline"
                        >
                          Read article
                          <IconArrowRight
                            stroke={2}
                            className="size-3.5"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}
