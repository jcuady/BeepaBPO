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
// TWO things, because there are three links in the chain and the obvious check
// only covers two of them:
//
//     source  ──(pnpm build)──>  .next  ──(next start)──>  process answering
//
// 1. The process answering must not be older than the build on disk.
// 2. The build on disk must not be older than the source.
//
// Checking only (1) passes happily when a product file is edited and the build
// is skipped: the process still predates no build, so the verdict is "fine",
// while every assertion describes a version of the product that was never
// compiled. That is the same class of defect as the stale server this script
// exists for — one link further down the chain — so it is closed here rather
// than left as the next person to discover mid-audit.
//
// Exit 0 when the server is current, 1 when it is stale OR the build is behind
// the source, 2 when it cannot be reached or has no build to compare against —
// because "cannot tell" must never be reported as "fine".
//
// Every exit path sets `process.exitCode` and returns instead of calling
// `process.exit()`. This script awaits a fetch at top level, and forcing the
// process down with a libuv handle still settling aborts with
// `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` on Windows — after
// printing the correct verdict. A gate that reports the right thing and then
// exits on a crash code is a gate whose result nobody can trust, because the
// runner only ever sees the number.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Only the trees that end up in a client bundle matter for what a browser can
// observe. `scripts/`, `docs/` and `tests/` do not ship.
const SOURCE_DIRS = ["app", "components", "lib"];

/** Newest mtime under the source trees, or null if none could be read. */
function newestSourceMtime(root = process.cwd(), depth = 0) {
  let newest = null;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    // `node_modules` inside a source tree is not product code, and walking it
    // would take longer than the build it is being compared against.
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (depth >= 6) continue;
      const nested = newestSourceMtime(full, depth + 1);
      if (nested !== null && (newest === null || nested > newest)) newest = nested;
      continue;
    }
    try {
      const m = statSync(full).mtimeMs;
      if (newest === null || m > newest) newest = m;
    } catch {
      /* a file that vanished mid-walk is not a finding */
    }
  }
  return newest;
}

/** Newest mtime across the trees that end up in a client bundle. */
function newestProductSourceMtime() {
  let newest = null;
  for (const name of SOURCE_DIRS) {
    const m = newestSourceMtime(join(process.cwd(), name));
    if (m !== null && (newest === null || m > newest)) newest = m;
  }
  return newest;
}

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
  const buildAgeMs = payload.buildAgeMs ?? null;
  const newestSourceMs = newestProductSourceMtime();
  const sourceAgeMs =
    newestSourceMs === null ? null : Math.max(0, Date.now() - newestSourceMs);

  console.log("SERVER BUILD FRESHNESS");
  console.log("─".repeat(60));
  console.log(`base          ${BASE}`);
  console.log(`build id      ${payload.buildId ?? "(none)"}`);
  console.log(`built at      ${payload.builtAt ?? "(none)"}`);
  console.log(`build age     ${secs(buildAgeMs)}`);
  console.log(`server uptime ${secs(payload.uptimeMs)}`);
  console.log(`newest source ${secs(sourceAgeMs)}\n`);

  // Same rule as `isServerStale`: strictly older age means newer file, and a
  // same-instant edit and build is not "behind".
  const behindSource =
    sourceAgeMs === null
      ? null
      : buildAgeMs === null || sourceAgeMs < buildAgeMs;

  if (payload.buildId === null) {
    console.error("ABORT: no .next/BUILD_ID on disk, so there is nothing to compare against.");
    console.error("      Run `pnpm build` before running behaviour gates.");
    process.exitCode = 2;
  } else if (payload.stale === true) {
    console.error("VERDICT: STALE. The server started before the current build was written.");
    console.error(`\n  up ${secs(payload.uptimeMs)} vs. build ${secs(buildAgeMs)} old.`);
    console.error("\nEvery assertion made against this server describes code that is no longer");
    console.error("on disk — in both directions: it can resurrect fixed defects and report");
    console.error("success for fixes that were never built. Restart it:\n");
    console.error("  # stop the process holding port 3100, then");
    console.error("  pnpm build");
    console.error("  npx next start -p 3100");
    process.exitCode = 1;
  } else if (behindSource === true) {
    console.error("VERDICT: THE BUILD IS BEHIND THE SOURCE.");
    console.error(`\n  a file under app/, components/ or lib/ changed ${secs(sourceAgeMs)} ago,`);
    console.error(`  but .next/BUILD_ID was written ${secs(buildAgeMs)} ago.`);
    console.error("\nThe server is faithfully serving the build on disk — and that build no");
    console.error("longer contains the code in your working tree, so every assertion made");
    console.error("against it describes a version of the product that was never compiled.");
    console.error("This is invisible to a server-staleness check: the process genuinely does");
    console.error("match the build. Rebuild and restart:\n");
    console.error("  # stop the process holding port 3100, then");
    console.error("  pnpm build");
    console.error("  npx next start -p 3100");
    process.exitCode = 1;
  } else if (behindSource === null) {
    console.error("ABORT: could not read any source file to compare against the build.");
    console.error("      Cannot tell whether the build is current, so not fine.");
    process.exitCode = 2;
  } else if (payload.stale === null || payload.stale === undefined) {
    console.error("ABORT: /api/health did not report staleness — cannot tell, so not fine.");
    process.exitCode = 2;
  } else {
    console.log("VERDICT: the server is running the build on disk, and the build matches the source.");
  }
}