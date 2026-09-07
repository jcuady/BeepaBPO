/**
 * HTTP smoke for cron auth + dry-run.
 * Usage: node --env-file=.env.local scripts/smoke-cron.mjs
 * Optional: SMOKE_BASE_URL=http://localhost:3000
 */
const base = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const secret = process.env.CRON_SECRET;

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
