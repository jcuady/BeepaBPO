import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/about",
    "/services",
    "/careers",
    "/resources",
    "/case-studies",
    "/contact",
    "/privacy",
    "/terms",
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE.url}${route || "/"}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/careers" ? 0.8 : 0.7,
  }));

  try {
    const supabase = await createClient();
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
        url: `${SITE.url}/careers/${job.slug}`,
        lastModified: new Date(
          job.updated_at ?? job.published_at ?? Date.now(),
        ),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const post of posts ?? []) {
      if (!post.slug) continue;
      entries.push({
        url: `${SITE.url}/resources/${post.slug}`,
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
        url: `${SITE.url}/case-studies/${study.slug}`,
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
