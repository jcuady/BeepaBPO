import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";

/**
 * Breadcrumb structured data for a top-level marketing route.
 *
 * Nine marketing pages shipped with no JSON-LD at all, which cost them every
 * rich result — including the breadcrumb trail, even though the hierarchy was
 * right there in the navigation. Declaring it is one line per page instead of
 * seven lines of `breadcrumbJsonLd([...])` plumbing, so the reason to omit it
 * (it is tedious) stops competing with the reason to add it (it is correct).
 *
 * `items` excludes the trailing page, which is the current document rather than
 * an ancestor; `breadcrumbJsonLd` numbers positions from 1.
 */
export function BreadcrumbJsonLd({ items }: { items: Array<{ name: string; path: string }> }) {
  return <JsonLd data={breadcrumbJsonLd(items)} />;
}