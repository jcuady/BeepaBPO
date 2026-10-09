import Link from "next/link";

type ListPagerProps = {
  page: number;
  pageSize: number;
  rowCount: number;
  /** Current filters to keep on Prev/Next (q, status, stage, …). */
  query?: Record<string, string | undefined>;
  /**
   * Query key for the page number. Defaults to `page`.
   *
   * Needed by `/app/cms`, which stacks six independent lists on one page rather
   * than putting each behind a tab. A single shared `page` param there would
   * mean scrolling to the testimonials pager and landing on testimonials page 3
   * because you had advanced FAQs. Each list gets its own key instead.
   */
  param?: string;
};

function hrefFor(page: number, query: Record<string, string | undefined>, param: string) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) qs.set(key, value);
  }
  if (page > 1) qs.set(param, String(page));
  const next = qs.toString();
  return next ? `?${next}` : "?";
}

/** Prev/Next that preserves the current FilterBar query string. */
export function ListPager({
  page,
  pageSize,
  rowCount,
  query = {},
  param = "page",
}: ListPagerProps) {
  const showPrev = page > 1;
  const showNext = rowCount >= pageSize;
  if (!showPrev && !showNext) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3"
    >
      {showPrev ? (
        <Link
          href={hrefFor(page - 1, query, param)}
          className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-base text-slate sm:text-sm">Page {page}</span>
      {showNext ? (
        <Link
          href={hrefFor(page + 1, query, param)}
          className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
