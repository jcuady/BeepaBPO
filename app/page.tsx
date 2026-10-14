import type { Metadata } from "next";
import LandingPage from "@/components/landing/landing-page";
import { faqs, type ProofCaseStudy, type ProofPost } from "@/components/landing/content";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationJsonLd,
  servicesItemListJsonLd,
  websiteJsonLd,
} from "@/lib/seo/json-ld";

/**
 * Read the real published proof.
 *
 * The brandbook forbids fabricated client logos, testimonials, metrics and
 * awards, so the landing page cannot invent social proof — it can only point at
 * what has genuinely been published. That makes this query the section's source
 * of truth: if nothing is published the section renders nothing, which is the
 * correct outcome and not a failure to hide.
 *
 * Fetched here rather than in the client component because `LandingPage` is
 * `"use client"` and cannot reach Supabase, and because this keeps the section's
 * content in the server-rendered HTML where a crawler can read it.
 */
async function readProof(): Promise<{ caseStudies: ProofCaseStudy[]; posts: ProofPost[] }> {
  const supabase = await createClient();
  const [studies, posts] = await Promise.all([
    supabase
      .from("case_studies")
      .select("slug, title, summary, client_name, industry")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
    supabase
      .from("blog_posts")
      .select("slug, title, excerpt")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  return {
    caseStudies: (studies.data ?? []) as ProofCaseStudy[],
    posts: (posts.data ?? []) as ProofPost[],
  };
}

/**
 * The landing page.
 *
 * This route deliberately lives at `app/page.tsx`, OUTSIDE the `(marketing)`
 * route group. The reference design ships its own header and footer, and
 * `app/(marketing)/layout.tsx` injects the shared `SiteHeader` / `SiteFooter`
 * into every route inside the group — so a landing page in that group would
 * render both sets of chrome. The other marketing routes keep the shared chrome
 * and are unchanged.
 *
 * Metadata goes through `pageMetadata()` rather than a literal `openGraph`
 * block. It used to declare `openGraph: { title, description }` directly, and
 * because Next.js replaces nested metadata objects instead of merging them, that
 * silently discarded the root layout's `url` and `images` — so the most-shared
 * page on the whole site was serving no `og:image` and no `og:url`. The helper
 * cannot express a partial `openGraph`, so it cannot happen again.
 */
export const metadata: Metadata = pageMetadata({
  title: "Filipino talent. Built around your business.",
  description:
    "Build a dedicated Filipino team with Beepa BPO — customer support, virtual assistants, back office, sales, IT and marketing, with live visibility into your people, payroll and performance.",
  path: "/",
  imageAlt: "Beepa — Your people. Your advantage.",
});

/**
 * `FAQPage` built from the same list the page renders.
 *
 * `faqItems` is imported from `./content` rather than retyped here. The earlier
 * version of this page read its FAQs out of the CMS and built the JSON-LD from
 * that same array; when the page was replaced, the structured data would have
 * silently gone with it — it renders nothing on screen, so nothing fails until
 * a rich-result check does. Sharing one array is what keeps it honest.
 */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default async function Page() {
  const proof = await readProof();

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={servicesItemListJsonLd()} />
      <JsonLd data={faqJsonLd} />
      <LandingPage proof={proof} />
    </>
  );
}