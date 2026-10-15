import type { MetadataRoute } from "next";
import { PRODUCTION_SITE_URL, resolveSiteUrl } from "@/lib/site-url";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Generate per request, not at build time and not on an interval.
 *
 * Measured: with no directive, `/sitemap.xml` was prerendered at build time and
 * served `x-nextjs-cache: HIT` indefinitely. `qa-exercise-sitemap-workflow.mjs`
 * caught it by publishing an article and finding it absent from a freshly
 * fetched sitemap, then correctly refusing to continue on an ungrounded
 * positive control.
 *
 * The failure hides itself. Everything published *before* the last deploy is
 * present -- at the time of checking, all 4 resources, 3 case studies and 5
 * jobs -- so the sitemap reads as correct. Only the newest row is missing, and
 * a sitemap is the one artefact nobody audits row by row.
 *
 * `revalidate = 3600` was tried first and does not fix it: ISR still served the
 * pre-publication document for up to an hour, so publishing an article left it
 * undiscoverable for the same reason, only less obviously.
 *
 * Per-request generation costs three indexed queries on a table this size, and
 * a sitemap is fetched by crawlers and by humans a handful of times a day. That
 * is a rounding error against the alternative: content that exists but cannot
 * be found. Correctness on read is the whole point of the file.
 */
export const dynamic = "force-dynamic";

/** Prefer production origin for Search Console even if preview env leaks. */
function seoOrigin(): string {
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
  const resolved = resolveSiteUrl();
  if (/localhost|127\.0\.0\.1/i.test(resolved)) return PRODUCTION_SITE_URL;
  return resolved;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = seoOrigin();

  const staticRoutes: {
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }[] = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/services", changeFrequency: "monthly", priority: 0.9 },
    { path: "/why-beepa", changeFrequency: "monthly", priority: 0.85 },
    { path: "/careers", changeFrequency: "weekly", priority: 0.85 },
    { path: "/about", changeFrequency: "monthly", priority: 0.8 },
    { path: "/resources", changeFrequency: "weekly", priority: 0.75 },
    { path: "/case-studies", changeFrequency: "monthly", priority: 0.7 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.8 },
    { path: "/security", changeFrequency: "monthly", priority: 0.7 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.75 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${origin}${route.path || "/"}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const supabase = createAnonClient();
    const [{ data: jobs }, { data: posts }, { data: studies }] =
      await Promise.all([
        supabase
          .from("job_posts")
          .select("slug, updated_at, published_at")
          .eq("status", "published")
          .limit(200),
        supabase
          .from("blog_posts")
          .select("slug, updated_at, published_at")
          .eq("status", "published")
          .limit(200),
        supabase
          .from("case_studies")
          .select("slug, updated_at, published_at")
          .eq("status", "published")
          .limit(200),
      ]);

    for (const job of jobs ?? []) {
      if (!job.slug) continue;
      entries.push({
        url: `${origin}/careers/${job.slug}`,
        lastModified: new Date(
          job.updated_at ?? job.published_at ?? Date.now(),
        ),
        changeFrequency: "weekly",
        priority: 0.65,
      });
    }

    for (const post of posts ?? []) {
      if (!post.slug) continue;
      entries.push({
        url: `${origin}/resources/${post.slug}`,
        lastModified: new Date(
          post.updated_at ?? post.published_at ?? Date.now(),
        ),
        changeFrequency: "monthly",
        priority: 0.55,
      });
    }

    for (const study of studies ?? []) {
      if (!study.slug) continue;
      entries.push({
        url: `${origin}/case-studies/${study.slug}`,
        lastModified: new Date(
          study.updated_at ?? study.published_at ?? Date.now(),
        ),
        changeFrequency: "monthly",
        priority: 0.55,
      });
    }
  } catch {
    // Sitemap still returns marketing routes if CMS/careers queries fail.
  }

  return entries;
}
