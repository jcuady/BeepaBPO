import { notFound } from "next/navigation";

/**
 * Catch-all for unmatched `/app/*` URLs.
 *
 * Without it, an unknown path under `/app` matches no segment at all, so Next
 * renders the ROOT `not-found.tsx` — the public marketing 404 with the site
 * header and footer. A signed-in user who mistypes a deep link, follows a stale
 * `action_url`, or opens an old bookmark therefore gets ejected out of the app
 * into the public marketing shell, where the only way onward is "Back to
 * homepage" and a fresh login.
 *
 * Matching the segment instead lets `notFound()` resolve to
 * `app/app/not-found.tsx`, which renders inside `AppShell` — the user keeps the
 * sidebar, the command palette and their session, and gets "Back to dashboard".
 *
 * Static and dynamic segments win over a catch-all, so every real route below
 * `/app` still resolves to its own page. This only catches what nothing else
 * claimed.
 *
 * TRADE-OFF, stated rather than hidden: a garbage URL under `/app` now runs
 * `app/app/layout.tsx` (and its `resolveWorkspace()` lookup) instead of being
 * answered by a static 404 with no work. Next matches routes before invoking a
 * catch-all, so real traffic is unaffected, and an unauthenticated request still
 * short-circuits to `/login` before any page renders. The cost is one session
 * lookup per bogus `/app` path.
 */
export default function AppCatchAll() {
  notFound();
}