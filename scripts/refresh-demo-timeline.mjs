/**
 * Re-base relative demo timestamps so the demo tenant does not decay — READ-ONLY unless `--apply`.
 *
 * Why this exists (2026-10-09)
 * ---------------------------
 * Several one-shot seed/audit scripts wrote demo rows using `Date.now()` offsets
 * — "due +72h from now", "response due +5 days", "interview in 2 days". Those
 * offsets were correct on the day they ran and become wrong silently as real time
 * passes. Nothing fails immediately; the demo just decays into a state nobody
 * intended:
 *
 *   scripts/audit/batch2-cleanup.mjs:118   tickets.sla_due_at        now + 72h
 *   scripts/audit/batch3-workflows.mjs:341  nte_cases.response_due_at now + 5d
 *   scripts/audit/batch3-workflows.mjs:219  interviews.scheduled_at   now + 2d
 *
 * This was caught by a gate failure, not by inspection: `live-data-smoke`
 * asserts the demo ticket carries a *future* SLA, and it went red with no code
 * change because the seeded deadline had simply slid past.
 *
 * Rather than write one repair script per symptom, this re-bases all of them, so
 * a new relative timestamp has one place to be declared instead of a new script
 * to be written and then forgotten.
 *
 * Scope is deliberately narrow: only rows currently in a *relative* demo state
 * are touched, and only when their timestamp has already lapsed. Historical rows
 * (invoices paid last month, NTE cases already answered) are left alone, because
 * moving those would falsify history.
 *
 * Run: node scripts/refresh-demo-timeline.mjs
 *      node scripts/refresh-demo-timeline.mjs --apply
 *
 * This is demo upkeep, not application code, and deliberately does not run in CI:
 * a CI job would rewrite the demo tenant on a schedule nobody reviewed.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function env() {
  const out = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[t.slice(0, i).trim()] = v;
    }
  }
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[k]) out[k] = process.env[k];
  }
  const key = out.SUPABASE_SECRET_KEY ?? out.SUPABASE_SERVICE_ROLE_KEY;
  if (!out.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL not found");
  if (!key) throw new Error("This script needs a privileged key (SUPABASE_SECRET_KEY)");
  return { url: out.NEXT_PUBLIC_SUPABASE_URL, key };
}

/**
 * Each rule names a table, the column holding a relative deadline, an optional
 * status filter limiting it to demo rows in flight, and the horizon to restore.
 */
const RULES = [
  {
    label: "open ticket SLA deadline",
    table: "tickets",
    column: "sla_due_at",
    horizon: 72 * HOUR,
    // Only unresolved tickets can carry a live SLA.
    filter: (r) => !["resolved", "closed"].includes(r.status),
    idColumn: "id",
    // A re-armed ticket must not still look answered: a deadline in the future
    // on a ticket with `resolved_at` set is a contradiction, and the badge
    // renders from both. This absorbs what `rearm-demo-ticket-sla.mjs` did, so
    // there is one place to declare relative demo timestamps rather than a new
    // repair script per symptom.
    //
    // The status is deliberately left ALONE. This rule used to map
    // `new` -> `open`, and `ticket_status` has no `open` — the enum is
    // new | assigned | in_progress | waiting_for_client | resolved | closed.
    // Postgres rejected the whole update with
    // `invalid input value for enum ticket_status: "open"`, so every lapsed
    // `new` ticket silently kept its dead deadline while the tool reported
    // "re-based 7/9; 2 failed". Re-basing a timestamp is not a reason to move
    // somebody's ticket between workflow states.
    extraPatch: () => ({
      resolved_at: null,
      first_response_at: null,
    }),
  },
  {
    label: "NTE response deadline",
    table: "nte_cases",
    column: "response_due_at",
    horizon: 5 * DAY,
    filter: (r) => r.status === "awaiting_response",
    idColumn: "id",
  },
  {
    label: "scheduled interview",
    table: "interviews",
    column: "scheduled_at",
    horizon: 2 * DAY,
    filter: () => true,
    idColumn: "id",
  },
];

const { url, key } = env();
const sb = createClient(url, key, { auth: { persistSession: false } });
const dryRun = !process.argv.includes("--apply");
console.log(`mode: ${dryRun ? "dry-run (no writes)" : "APPLY"}`);
console.log(`now: ${new Date().toISOString()}\n`);

const patches = [];

for (const rule of RULES) {
  const { data, error } = await sb.from(rule.table).select("*").limit(500);
  if (error) {
    console.log(`  [skip] ${rule.table}: ${error.message}`);
    continue;
  }
  const lapsed = (data ?? []).filter((r) => {
    const v = r[rule.column];
    if (!v) return false;
    return new Date(v).getTime() <= Date.now() && rule.filter(r);
  });

  if (lapsed.length === 0) {
    const pending = (data ?? []).filter((r) => r[rule.column] && rule.filter(r)).length;
    console.log(`  [ok]   ${rule.label}: ${pending} in flight, none lapsed`);
    continue;
  }

  console.log(`  [fix]  ${rule.label}: ${lapsed.length} row(s) lapsed`);
  for (const r of lapsed) {
    const was = r[rule.column];
    const next = new Date(Date.now() + rule.horizon).toISOString();
    console.log(`         ${r[rule.idColumn]}  ${was} -> ${next}`);
    patches.push({
      rule,
      id: r[rule.idColumn],
      was,
      next,
      extra: rule.extraPatch ? rule.extraPatch(r) : {},
    });
  }
}

console.log(`\ntotal: ${patches.length} row(s) would be re-based`);

if (patches.length === 0) {
  console.log("demo timeline is current — nothing to do.");
  process.exit(0);
}

if (dryRun) {
  console.log("re-run with --apply to write");
  process.exit(0);
}

let failed = 0;
for (const p of patches) {
  const { error } = await sb
    .from(p.rule.table)
    .update({ [p.rule.column]: p.next, ...p.extra })
    .eq(p.rule.idColumn, p.id);
  if (error) {
    failed++;
    console.error(`  FAILED ${p.rule.table}/${p.id}: ${error.message}`);
  }
}

console.log(`\nre-based ${patches.length - failed}/${patches.length} row(s); ${failed} failed`);
process.exit(failed ? 2 : 0);