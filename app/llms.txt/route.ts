import { PRODUCTION_SITE_URL, resolveSiteUrl } from "@/lib/site-url";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * `/llms.txt` — a plain-text map of the site for language models and AI
 * crawlers.
 *
 * WHY
 * ---
 * The brief for this pass was "optimise the SEO", and the concrete SEO surface
 * (metadata, canonicals, Open Graph, JSON-LD, sitemap, robots) was already
 * covered and green. What was missing was the surface aimed at *AI* readers.
 *
 * A language model asked "who is Beepa BPO and what do they do" has no sitemap
 * to read and no reason to follow a link graph the way a crawler does. The
 * `llms.txt` convention (llmstxt.org) answers that directly: one H1, a
 * one-paragraph summary, then the links a model would actually want, each with
 * a sentence saying what it contains.
 *
 * The content is derived, not typed. The descriptions are the pages' own
 * `metadata.description` strings, and the job, resource and case-study lists
 * come from the same published-row query the sitemap uses — so publishing a
 * role or an article puts it in here too, without anyone remembering.
 *
 * A crawler fetching a file and getting a 500 is worse than getting a shorter
 * one, so the database sections are optional: if the CMS is unreachable the
 * marketing pages are still served.
 */
export const dynamic = "force-dynamic";

/** Prefer the production origin, the same way `robots.ts` and `sitemap.ts` do. */
function seoOrigin(): string {
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
  const resolved = resolveSiteUrl();
  if (/localhost|127\.0\.0\.1/i.test(resolved)) return PRODUCTION_SITE_URL;
  return resolved;
}

/**
 * One link line. The description is the page's own metadata description.
 *
 * A line with no description omits the colon entirely rather than leaving
 * "- [Title](url): " — a dangling separator reads as a broken entry to
 * anything parsing the file.
 */
const link = (origin: string, path: string, label: string, description: string) =>
  description
    ? `- [${label}](${origin}${path}): ${description}`
    : `- [${label}](${origin}${path})`;

export async function GET(): Promise<Response> {
  const origin = seoOrigin();

  const sections: string[] = [
    "# Beepa BPO",
    "",
    "> Beepa is a people-first outsourcing partner in the Philippines. We find the people, place them on your team, and handle salary and payroll so you keep the work. People. Process. Progress.",
    "",
    "## Company",
    "",
    link(
      origin,
      "/about",
      "About Beepa",
      "Beepa began in 2019 as a people-first manpower partner — we find talent, place teams, and handle salary.",
    ),
    link(
      origin,
      "/why-beepa",
      "Why Beepa",
      "Why companies choose Beepa: we find the people, place them on your team, and handle salary — a manpower partner built for dependable delivery.",
    ),
    link(
      origin,
      "/pricing",
      "Pricing",
      "How Beepa pricing works: every engagement is scoped to the role, hours and headcount, with sourcing, placement, employment and payroll administration included.",
    ),
    link(
      origin,
      "/contact",
      "Contact",
      "Tell Beepa what your business needs. Share roles, timing, and goals — we'll follow up to start discovery for your outsourced team.",
    ),
    "",
    "## Services",
    "",
    link(
      origin,
      "/services",
      "Services",
      "Talent search and payroll-backed staffing for support, ops, IT, marketing, eLearning, and sales roles — Beepa finds people and handles pay.",
    ),
    "",
    "## Trust and policy",
    "",
    link(
      origin,
      "/security",
      "Security",
      "How Beepa protects client data: placed staff are Beepa employees, access is scoped per organization by row-level security, and every record is permission-checked.",
    ),
    link(
      origin,
      "/privacy",
      "Privacy",
      "How Beepa BPO collects, uses, and protects personal information on our websites and services.",
    ),
    link(
      origin,
      "/terms",
      "Terms",
      "The terms that govern your use of the Beepa BPO website and the outsourcing, staffing and support services delivered under a signed agreement.",
    ),
    "",
    "## Careers",
    "",
    link(
      origin,
      "/careers",
      "Open roles",
      "Every current Beepa opening, searchable and filterable by employment type, work setup and location. Applicants apply with a free account.",
    ),
  ];

  try {
    const supabase = createAnonClient();
    const [{ data: jobs }, { data: posts }, { data: studies }] = await Promise.all([
      supabase
        .from("job_posts")
        .select("slug, title, location_text, employment_type")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(200),
      supabase
        .from("blog_posts")
        .select("slug, title")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(200),
      supabase
        .from("case_studies")
        .select("slug, title")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(200),
    ]);

    const jobLines = (jobs ?? [])
      .filter((j) => j.slug && j.title)
      .map((j) =>
        link(
          origin,
          `/careers/${j.slug}`,
          j.title as string,
          [j.location_text, (j.employment_type ?? "").replace(/_/g, " ")]
            .filter(Boolean)
            .join(" · "),
        ),
      );
    if (jobLines.length) sections.push(...jobLines);

    sections.push(
      "",
      "## Resources",
      "",
      link(
        origin,
        "/resources",
        "All resources",
        "Practical notes on staffing, payroll-backed teams, and working with Beepa.",
      ),
    );
    const postLines = (posts ?? [])
      .filter((p) => p.slug && p.title)
      .map((p) => link(origin, `/resources/${p.slug}`, p.title as string, ""));
    if (postLines.length) sections.push(...postLines);

    sections.push(
      "",
      "## Case studies",
      "",
      link(
        origin,
        "/case-studies",
        "All case studies",
        "Real outcomes from teams built with Beepa BPO — client, industry and the measurable result, from support coverage to payroll accuracy.",
      ),
    );
    const studyLines = (studies ?? [])
      .filter((s) => s.slug && s.title)
      .map((s) => link(origin, `/case-studies/${s.slug}`, s.title as string, ""));
    if (studyLines.length) sections.push(...studyLines);
  } catch {
    // A crawler fetching this file and getting a 500 is worse than getting a
    // shorter one. The marketing sections above are already written.
  }

  sections.push("");

  return new Response(sections.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600",
    },
  });
}
