import Link from "next/link";
import { IconFileUnknown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

/**
 * The app's 404.
 *
 * This page previously did not exist, so any dead link inside `/app` rendered
 * Next's built-in "404 This page could not be found" — a bare document with no
 * navigation at all. That is a dead end in a tool people use all day, and it is
 * not hypothetical: the payroll audit page links to period ids that the payroll
 * exercise deletes (QA report §6, row 15), and any stale `action_url` lands the
 * same way. The user arrives with no header, no sidebar and no way back.
 *
 * `data-page-status` is the same machine-readable marker `forbidden.tsx` and
 * `error.tsx` use, so an auditor scoring a page by attribute sees a 404 rather
 * than reading it as a clean page. It renders inside `AppShell`, so the signed-in
 * user keeps their navigation.
 */
export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-3xl py-10" data-page-status="not-found">
      <div className="flex flex-col items-center rounded-none border border-dashed border-line bg-white px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-none bg-mist text-slate">
          <IconFileUnknown stroke={1.75} className="size-6" />
        </div>
        <p className="mt-4 font-display text-sm font-semibold uppercase tracking-wide text-slate">
          404 Not Found
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy">
          This page does not exist
        </h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-slate">
          The link may be out of date, or the record it pointed to may have been
          removed. Nothing is broken on your side.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/app" />}
          >
            Back to dashboard
          </Button>
          <Button
            className="min-h-11"
            variant="secondary"
            nativeButton={false}
            render={<Link href="/app/tickets" />}
          >
            Go to tickets
          </Button>
        </div>
      </div>
    </div>
  );
}