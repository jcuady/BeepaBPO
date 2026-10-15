// Is the server answering the browser the build that is on disk?
//
// WHY THIS EXISTS
// ---------------
// A full 21-exercise workflow run produced 482 assertions against a server
// started at 18:16 while `pnpm build` wrote `.next/BUILD_ID` at 19:21. One
// assertion failed with copy that the current source cannot produce, and the
// probe against the live database confirmed the provider really does return the
// status the fixed code branches on. The suite was measuring code that had been
// replaced an hour earlier.
//
// Nothing in the suite noticed, because the runner asks "is the server alive?"
// before believing a failure — which is a different question from "is the server
// running the code I think it is?". A stale server resurrects defects that were
// fixed, and just as dangerously reports success for fixes that were never in
// the build.
//
// THE RULE
// --------
// Any run that produces evidence about product behaviour must first establish
// that the process answering is not older than the build on disk. `/api/health`
// answers with `process.uptime()` and the age of `.next/BUILD_ID`; if the
// process has been up for less time than the build is old, it cannot have
// loaded that build.
//
// Exit 0 when the server is current, 1 when it is stale, 2 when it cannot be
// reached or has no build to compare against — because "cannot tell" must never
// be reported as "fine".
//
// Every exit path sets `process.exitCode` and returns instead of calling
// `process.exit()`. This script awaits a fetch at top level, and forcing the
// process down with a libuv handle still settling aborts with
// `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` on Windows — after
// printing the correct verdict. A gate that reports the right thing and then
// exits on a crash code is a gate whose result nobody can trust, because the
// runner only ever sees the number.

const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3100";

const url = `${BASE.replace(/\/$/, "")}/api/health`;

const secs = (ms) => (ms === null || ms === undefined ? "?" : `${Math.round(ms / 1000)}s`);

let payload;
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    console.error(`ABORT: ${url} answered ${res.status}.`);
    process.exitCode = 2;
  } else {
    payload = await res.json();
  }
} catch (e) {
  console.error(`ABORT: could not reach ${url} — ${e.message}`);
  console.error("Start it with: npx next start -p 3100");
  process.exitCode = 2;
}

if (payload) {
  console.log("SERVER BUILD FRESHNESS");
  console.log("─".repeat(60));
  console.log(`base          ${BASE}`);
  console.log(`build id      ${payload.buildId ?? "(none)"}`);
  console.log(`built at      ${payload.builtAt ?? "(none)"}`);
  console.log(`build age     ${secs(payload.buildAgeMs)}`);
  console.log(`server uptime ${secs(payload.uptimeMs)}\n`);

  if (payload.buildId === null) {
    console.error("ABORT: no .next/BUILD_ID on disk, so there is nothing to compare against.");
    console.error("      Run `pnpm build` before running behaviour gates.");
    process.exitCode = 2;
  } else if (payload.stale === true) {
    console.error("VERDICT: STALE. The server started before the current build was written.");
    console.error(`\n  up ${secs(payload.uptimeMs)} vs. build ${secs(payload.buildAgeMs)} old.`);
    console.error("\nEvery assertion made against this server describes code that is no longer");
    console.error("on disk — in both directions: it can resurrect fixed defects and report");
    console.error("success for fixes that were never built. Restart it:\n");
    console.error("  # stop the process holding port 3100, then");
    console.error("  pnpm build");
    console.error("  npx next start -p 3100");
    process.exitCode = 1;
  } else if (payload.stale === null || payload.stale === undefined) {
    console.error("ABORT: /api/health did not report staleness — cannot tell, so not fine.");
    process.exitCode = 2;
  } else {
    console.log("VERDICT: the server is running the build on disk.");
  }
}