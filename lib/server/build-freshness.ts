/**
 * Is the process answering older than the build on disk?
 *
 * WHY THIS IS A SEPARATE FILE
 * --------------------------
 * The comparison was wrong when it was first written, and it was caught by
 * reading a live response rather than by reasoning about it: it read
 * `uptime < buildAge` as stale, which makes every freshly started server report
 * stale one second after `next start`, because by then the build is older than
 * the process. It is three lines of logic, and it is load-bearing — the whole
 * workflow suite refuses to produce evidence on the strength of it — so it
 * lives here where a table test can pin the direction, instead of inline in a
 * route that can only be exercised by starting a server.
 *
 * Same reasoning as `lib/auth/error-messages.ts`: keep the decision out of the
 * place that is awkward to test.
 */

/**
 * @param uptimeMs   how long the serving process has been running
 * @param buildAgeMs how long ago `.next/BUILD_ID` was written, or null if there
 *                   is no build to compare against
 *
 * Stale means the process has been up for LONGER than the build is old: it
 * started before this build existed, so it cannot have loaded it.
 *
 * null means "cannot tell", which callers must never report as "fine" — a dev
 * server with no `.next` is not a fresh production build.
 */
export function isServerStale(
  uptimeMs: number,
  buildAgeMs: number | null,
): boolean | null {
  if (buildAgeMs === null) return null;
  return uptimeMs > buildAgeMs;
}