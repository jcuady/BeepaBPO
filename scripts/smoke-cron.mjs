/**
 * HTTP smoke for cron auth + dry-run.
 * Usage: node scripts/smoke-cron.mjs
 * Optional: QA_BASE_URL=http://localhost:3100
 *
 * `QA_BASE_URL` first, matching every other HTTP script in this repo. It used to
 * read only `SMOKE_BASE_URL` and default to port 3000, so it aimed at a port
 * nothing serves — the same drift `audit-suite-base-url` exists to catch, in the
 * one script that gate could not see because it drove neither Playwright nor a
 * `const BASE =`.
 *
 * It also read `CRON_SECRET` from the environment only, which required callers to
 * pass `--env-file=.env.local`. A gate runner spawns a bare `node <script>`, so
 * wiring this into `qa-run-all.mjs` would have made it exit 1 with "CRON_SECRET
 * missing" on every run — a permanently red gate that teaches people to ignore
 * red. It reads `.env.local` itself, like its siblings.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const EVIDENCE = "docs/evidence/cron-smoke.json";

/**
 * Write this smoke's verdict to disk.
 *
 * WHY
 * ---
 * This checks the two things that keep a cron endpoint from being an
 * unauthenticated remote trigger — a bare POST must be refused, and an
 * authorised dry run must report `ok` without doing the work. Both are exactly
 * the kind of claim that is asserted once, in a terminal, and then inherited as
 * fact by every document that quotes "the cron endpoint refuses unauthenticated
 * calls". Without a file there is nothing to re-read and nothing to date against
 * the build.
 *
 * Every exit path writes, including the failure ones: `statuses.unauthenticated`
 * is the measurement. A smoke test whose evidence file only appears when it
 * passes records nothing about the failure it was written to catch.
 */
function writeEvidence(exitCode, verdict, verdictText, data = {}) {
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    EVIDENCE,
    JSON.stringify(
      {
        check: "cron-smoke",
        generatedAt: new Date().toISOString(),
        base,
        endpoint: `${base}/api/jobs/cron`,
        verdict,
        verdictText,
        unauthenticatedStatus: null,
        dryRunOk: null,
        dryRunFlag: null,
        ...data,
        exitCode,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`wrote ${EVIDENCE}`);
}

/** Same shape as the other audit scripts in `scripts/audit/`. */
function env() {
  const out = {};
  if (!existsSync(".env.local")) return out;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let x = line.slice(i + 1).trim();
    if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
    out[line.slice(0, i).trim()] = x;
  }
  return out;
}

const e = env();
const base = (process.env.QA_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3100").replace(
  /\/$/,
  "",
);
const secret = process.env.CRON_SECRET ?? e.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET missing");
  // Not a skip and not a pass: the check could not run. Recording that is the
  // whole point, because "no evidence file" and "the endpoint was never
  // exercised" are indistinguishable to whoever reads this next.
  writeEvidence(2, "unknown", "CANNOT TELL — CRON_SECRET is not configured for this process");
  process.exit(1);
}

async function main() {
  const unauth = await fetch(`${base}/api/jobs/cron`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job: "all", dryRun: true }),
  });
  if (unauth.status !== 401) {
    console.error("expected 401 without secret, got", unauth.status);
    // Written BEFORE exiting: the observed status is the finding. A 200 here is
    // an unauthenticated cron trigger, and the file must be able to prove it.
    writeEvidence(1, "open", `unauthenticated POST was answered ${unauth.status}, expected 401`, {
      unauthenticatedStatus: unauth.status,
    });
    process.exit(1);
  }

  const dry = await fetch(`${base}/api/jobs/cron`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ job: "all", dryRun: true }),
  });
  const dryBody = await dry.json();
  if (!dry.ok || !dryBody.ok || dryBody.dryRun !== true) {
    console.error("dry-run failed", dry.status, dryBody);
    writeEvidence(1, "dry-run-failed", `authorised dry run answered ${dry.status}`, {
      unauthenticatedStatus: unauth.status,
      dryRunOk: Boolean(dry.ok && dryBody.ok),
      dryRunFlag: dryBody.dryRun ?? null,
    });
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        base,
        unauthorized: unauth.status,
        dryRun: dryBody.results,
      },
      null,
      2,
    ),
  );
  writeEvidence(0, "closed", "unauthenticated refused with 401; authorised dry run honoured", {
    unauthenticatedStatus: unauth.status,
    dryRunOk: true,
    // The flag, not just the truthiness: a dry run that reported ok while
    // actually performing the work would pass this gate as written, and the
    // file is where that becomes visible later.
    dryRunFlag: dryBody.dryRun,
    jobsConsidered: Array.isArray(dryBody.results) ? dryBody.results : null,
  });
}

main().catch((err) => {
  console.error(err);
  // A thrown fetch error (server down, connection refused) is "cannot tell", and
  // it used to leave no trace at all.
  writeEvidence(2, "unknown", `could not complete the smoke: ${err.message}`);
  process.exit(1);
});
