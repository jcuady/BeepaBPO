import type { Metadata } from "next";
import { BRAND } from "@/lib/site";

/**
 * One way to write page metadata, so a page cannot ship a half-built one.
 *
 * ## Why this exists
 *
 * Next.js does NOT deep-merge nested metadata objects. A page that declares
 * `openGraph: { title, description }` **replaces** the root layout's entire
 * `openGraph` block, silently dropping `url`, `images`, `siteName` and `type`.
 *
 * That is not theoretical. Four files declared their own `openGraph` —
 * `app/page.tsx`, `app/(marketing)/contact/page.tsx` and
 * `app/(marketing)/careers/[slug]/page.tsx` — and those were precisely the
 * routes serving no `og:image` and no `og:url`. Every share of the homepage on
 * LinkedIn, Slack, WhatsApp and iMessage rendered as a bare link, and the
 * careers pages did the same. The root layout had an `og:image` the whole time;
 * the pages were throwing it away without any error.
 *
 * Requiring each page to remember four extra fields is a convention, and
 * conventions are what produced this bug. `pageMetadata()` makes the complete
 * set the only way to do it: there is no partial `openGraph` to write.
 */

/** Google's truncation: the title is cut off around 60 characters. */
export const TITLE_MAX = 60;
/** Google's truncation: the description is cut off around 160 characters. */
export const DESCRIPTION_MIN = 70;
export const DESCRIPTION_MAX = 160;

/** Trim a description to the SERP budget on a word boundary. */
export function clampDescription(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

/**
 * Fit a title into the SERP budget *including* the brand suffix.
 *
 * The root layout applies a `%s | ${BRAND.name}` template, so a 58-character CMS
 * title becomes a 68-character result and Google cuts it mid-word. Measuring
 * the page title alone therefore hides the overflow — the number that matters is
 * the composed one.
 *
 * This emits `title.absolute`, which bypasses the template, because once we have
 * budgeted the suffix ourselves the template would add it a second time.
 */
function clampTitle(title: string): string {
  const composed = `${title} | ${BRAND.name}`;
  if (composed.length <= TITLE_MAX) return composed;
  const budget = TITLE_MAX - BRAND.name.length - 3; // " | "
  if (budget < 12) return composed;
  const cut = title.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (lastSpace > budget * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, "");
  return `${trimmed}… | ${BRAND.name}`;
}

type PageMetadataInput = {
  title: string;
  description: string;
  /** Route path, e.g. "/careers/hr". Used for canonical and og:url. */
  path: string;
  /** og:type. Article for dated editorial, website for everything else. */
  type?: "website" | "article";
  image?: string;
  imageAlt?: string;
  publishedTime?: string;
  noindex?: boolean;
};

export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  image,
  imageAlt,
  publishedTime,
  noindex,
}: PageMetadataInput): Metadata {
  const url = `${BRAND.url}${path === "/" ? "" : path}`;
  const description_ = clampDescription(description);
  const imageUrl = image ?? BRAND.ogImageUrl;
  const title_ = clampTitle(title);

  return {
    title: { absolute: title_ },
    description: description_,
    alternates: { canonical: path },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type,
      url,
      siteName: BRAND.name,
      locale: "en_US",
      title: title_,
      description: description_,
      ...(publishedTime ? { publishedTime } : {}),
      images: [
        {
          url: imageUrl,
          width: 1672,
          height: 941,
          alt: imageAlt ?? `${BRAND.name} — ${BRAND.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title_,
      description: description_,
      images: [imageUrl],
    },
  };
}