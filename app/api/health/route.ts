import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { isServerStale } from "@/lib/server/build-freshness";

/**
 * Is the server answering right now the build that is on disk?
 *
 * WHY THIS EXISTS
 * ---------------
 * A full 21-exercise workflow run was executed against a server that had been
 * started at 18:16 while `pnpm build` wrote `.next/BUILD_ID` at 19:21. Every
 * assertion in that run — 482 of them — was measured against code that was no
 * longer on disk. One of them failed:
 *
 *     signup creates an account and asks for email verification
 *       -- "Unable to create account with that email."
 *
 * which reads as a live P2 auth defect: signup blaming the user's address for a
 * Supabase 429. It is not. `signupErrorMessage` has mapped 429 to "Too many
 * sign-up attempts" since 2026-10-10, `qa-probe-signup-error.mjs` confirms
 * Supabase answers 429, and both strings are present in the current build. The
 * process had simply been serving the previous one for 65 minutes.
 *
 * THE FAILURE IS SILENT AND IT CUTS BOTH WAYS
 * -------------------------------------------
 * A stale server does not only resurrect fixed defects. It also reports success
 * for fixes that were never in the build the user was looking at. Either way the
 * evidence is not evidence, and nothing in the suite noticed: the runner probes
 * that the server is alive, which is not the same question.
 *
 * HOW IT IS DECIDED
 * -----------------
 * `process.uptime()` is how long THIS process has been running; the age of
 * `.next/BUILD_ID` on disk is how long ago the build was written.
 *
 * Stale means the process has been up for LONGER than the build is old — it
 * started before this build existed, so it cannot have loaded it. The first
 * version of this route had the comparison backwards (`uptime < buildAge`,
 * "stale"), which made every freshly started server report stale the moment a
 * second passed between the build finishing and `next start` launching. It was
 * caught by reading the real response rather than by reasoning about it.
 *
 * Deliberately no auth and no secrets: this is an ops/QA surface, and it exposes
 * only build timing.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const buildIdPath = join(process.cwd(), ".next", "BUILD_ID");
  const present = existsSync(buildIdPath);

  const builtAtMs = present ? statSync(buildIdPath).mtimeMs : null;
  const buildAgeMs = builtAtMs === null ? null : Date.now() - builtAtMs;
  const uptimeMs = Math.round(process.uptime() * 1000);

  return Response.json({
    ok: true,
    buildId: present ? readFileSync(buildIdPath, "utf8").trim() : null,
    builtAt: builtAtMs === null ? null : new Date(builtAtMs).toISOString(),
    buildAgeMs,
    uptimeMs,
    stale: isServerStale(uptimeMs, buildAgeMs),
  });
}