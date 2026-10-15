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
import { readFileSync, existsSync } from "node:fs";

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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
