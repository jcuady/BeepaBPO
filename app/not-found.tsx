import Link from "next/link";
import { IconFileUnknown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * The root 404, for every route outside `/app`.
 *
 * Without this file Next served its built-in not-found document: a bare page
 * with no links on it at all, carrying the marketing `<title>` and nothing else.
 * A mistyped URL, a retired blog slug, or a bad campaign link therefore ended
 * the visit at a dead end with no way to continue browsing.
 *
 * This is a server component and reuses the marketing chrome, so the public 404
 * reads as part of the site rather than as a framework message. `data-page-status`
 * matches the markers in `app/app/forbidden.tsx` and `app/app/error.tsx`, so an
 * auditor can tell a 404 from a clean page without matching on copy.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-clip">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-none focus:bg-white focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:font-semibold focus:text-navy focus:shadow"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className="flex flex-1 items-center py-16">
        <div
          className="mx-auto flex w-full max-w-lg flex-col items-center px-6 text-center"
          data-page-status="not-found"
        >
          <div className="flex size-12 items-center justify-center rounded-none bg-mist text-slate">
            <IconFileUnknown stroke={1.75} className="size-6" />
          </div>
          <p className="mt-4 font-display text-sm font-semibold uppercase tracking-wide text-slate">
            404 Not Found
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-navy">
            We couldn&apos;t find that page
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate">
            The page may have moved, or the link that brought you here may be out
            of date.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              className="min-h-11"
              nativeButton={false}
              render={<Link href="/" />}
            >
              Back to homepage
            </Button>
            <Button
              className="min-h-11"
              variant="secondary"
              nativeButton={false}
              render={<Link href="/services" />}
            >
              What we do
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}