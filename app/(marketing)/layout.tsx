import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `font-marketing` — DM Sans, the public voice. Applied here rather than
    // per page so a new marketing route inherits it. See `--font-marketing` in
    // app/globals.css for why this differs from the product app's Inter.
    <div className="overflow-x-clip font-marketing">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-none focus:bg-white focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:font-semibold focus:text-navy focus:shadow"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
