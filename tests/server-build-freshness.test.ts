import { describe, expect, it } from "vitest";

import { isServerStale, isBuildBehindSource } from "../lib/server/build-freshness";

/**
 * The staleness rule, pinned in both directions.
 *
 * A full 21-exercise workflow run once produced 482 assertions against a server
 * that had been running 65 minutes less than the age of `.next/BUILD_ID`. Every
 * assertion described code that was no longer on disk, and one failed with copy
 * the current source cannot produce — reading as a live auth defect (signup
 * blaming the user's address for a Supabase 429) when the real cause was that
 * nobody restarted the server after building.
 *
 * `qa-run-workflows.mjs` now refuses to produce evidence at all unless this says
 * the server is current, so the direction of the comparison is load-bearing for
 * every behavioural claim in the repository.
 *
 * The first version of this rule was inverted (`uptime < buildAge`), which
 * reports a correctly started server as stale one second after `next start`,
 * because the build is by then older than the process. It was caught by reading
 * the live `/api/health` response, not by reasoning about it. Both directions are
 * asserted here so it cannot come back.
 */
describe("isServerStale", () => {
  const MIN = 60_000;

  it("calls a server started after the build fresh", () => {
    // Build finished 25s ago, server came up 11s ago. Correct and current.
    expect(isServerStale(11_000, 24_830)).toBe(false);
  });

  it("calls a server long up against a brand-new build stale", () => {
    // The measured case: up 65 minutes, build 1 second old.
    expect(isServerStale(65 * MIN, 1_000)).toBe(true);
  });

  it("does not call a server stale just because the build is old", () => {
    // The inverted rule's false positive. Up 60s, build 2 minutes old: the
    // process started 60s ago, the build was written 60s before that, so this
    // is a correctly restarted server and must read fresh. The first draft of
    // this test passed (180s, 120s) and asserted `false` for a case that is
    // genuinely stale — the fixture was wrong, not the function.
    expect(isServerStale(60_000, 2 * MIN)).toBe(false);
  });

  it("calls it stale when the process started even slightly before the build", () => {
    // The same numbers the other way round: up 2 minutes, build 60s old, so the
    // process is 60s older than the build it would have to be serving.
    expect(isServerStale(2 * MIN, 60_000)).toBe(true);
  });

  it("treats the boundary as fresh, because a start after the build cannot be stale", () => {
    // Equal numbers means the process started in the same instant the build was
    // written. Treating it as stale would make a legitimate restart non-deterministic.
    expect(isServerStale(10_000, 10_000)).toBe(false);
  });

  it("cannot tell when there is no build to compare against", () => {
    // A dev server with no `.next` is not a fresh production build. `null` is
    // carried through so callers exit 2 rather than reporting agreement.
    expect(isServerStale(5_000, null)).toBeNull();
  });
});

/**
 * The second link in the chain, pinned in both directions.
 *
 * `isServerStale` compares the serving process to `.next/BUILD_ID`. That is not
 * the whole claim: it is silent about `app/`, `components/` and `lib/`. Edit a
 * product file, skip `pnpm build`, and uptime is still comfortably under the
 * build's age — so the first rule reports fine — while every assertion made
 * against that server describes a build that does not contain the edit.
 */
describe("isBuildBehindSource", () => {
  const MIN = 60_000;

  it("is behind when a source file was edited after the build was written", () => {
    // Build 2 minutes old, source edited 30 seconds ago.
    expect(isBuildBehindSource(2 * MIN, 30_000)).toBe(true);
  });

  it("is NOT behind when the build postdates every source file", () => {
    // The healthy case, and the one that must stay quiet: a build written after
    // the last edit. This is the false positive the rule would have if the ages
    // were compared the wrong way round.
    expect(isBuildBehindSource(30_000, 2 * MIN)).toBe(false);
  });

  it("treats a same-instant edit and build as not behind", () => {
    // Editing and building inside one filesystem tick is common on a fast
    // machine. Calling that stale would make the gate non-deterministic.
    expect(isBuildBehindSource(10_000, 10_000)).toBe(false);
  });

  it("is behind by definition when there is a source tree but no build", () => {
    // The inverse of the `null` case above: there is something to measure
    // against, and it has not been compiled.
    expect(isBuildBehindSource(null, 5_000)).toBe(true);
  });

  it("cannot tell when there is no source to compare against", () => {
    // Callers must exit 2 rather than assume agreement.
    expect(isBuildBehindSource(30_000, null)).toBeNull();
  });
});