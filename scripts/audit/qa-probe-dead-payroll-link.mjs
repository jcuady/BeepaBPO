// Which table still holds a link to the deleted payroll period `42df33d5-…`?
//
// NARROW ON PURPOSE. The first version of this probe asked "which rows reference a deleted
// payroll period?" and answered with garbage: 62 of 62 notifications "referencing a deleted
// period" and 30 of 30 approval requests. Both numbers were the probe's fault, not the
// database's.
//
//   - a `__none__` sentinel was compared against the live-id set, so every notification with
//     a non-payroll URL (`/app/tickets`, `/app/leave`) counted as a hit;
//   - EVERY `approval_requests` row was compared against live PAYROLL PERIOD ids, so leave
//     requests and cash advances -- different entities entirely -- all counted as dead.
//
// That is the same class of error as comparing `payroll_record` ids against period ids, which
// nearly made live audit history look safe to delete. A broad survey across entity types
// invites exactly that. So this asks the one question the failure actually raises: does
// anything still point at THAT period?
//
// Read-only.
//
// Usage: node scripts/audit/qa-probe-dead-payroll-link.mjs [period-id]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const TARGET = process.argv[2] ?? "42df33d5-f7b2-4194-8bc7-2ac75f4eead7";
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const must = async (p, what) => {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
};

const { data: exists } = await db.from("payroll_periods").select("id").eq("id", TARGET).maybeSingle();
console.log(`target period: ${TARGET}  ${exists ? "STILL EXISTS" : "deleted"}\n`);

// Each probe is an EXACT match on that id, filtered by the entity type that owns it. No
// cross-type comparison, no sentinel, no "looks like a uuid" heuristics.
const probes = [
  ["audit_logs (entity_type=payroll_period)", "audit_logs",
    db.from("audit_logs").select("id, action, entity_type, created_at").eq("entity_type", "payroll_period").eq("entity_id", TARGET)],
  ["notifications (entity_type=payroll_period)", "notifications",
    db.from("notifications").select("id, title, body, action_url, created_at").eq("entity_type", "payroll_period").eq("entity_id", TARGET)],
  ["notifications (action_url contains the id)", "notifications",
    db.from("notifications").select("id, title, body, action_url, created_at").like("action_url", `%${TARGET}%`)],
  ["approval_requests (entity_id)", "approval_requests",
    db.from("approval_requests").select("id, status, current_step, created_at").eq("entity_id", TARGET)],
  ["approval_actions (via request)", "approval_actions", null],
  ["payroll_records", "payroll_records",
    db.from("payroll_records").select("id, employee_id").eq("payroll_period_id", TARGET)],
];

let total = 0;
for (const [label, table, q] of probes) {
  if (!q) {
    const { data: reqs } = await must(
      db.from("approval_requests").select("id").eq("entity_id", TARGET), "requests",
    );
    const ids = (reqs ?? []).map((r) => r.id);
    const actions = ids.length
      ? await must(db.from("approval_actions").select("id, action, step_order").in("request_id", ids), "actions")
      : [];
    console.log(`${label.padEnd(46)} ${actions.length}`);
    total += actions.length;
    for (const a of actions) console.log(`      action=${a.action} step=${a.step_order}`);
    continue;
  }
  const rows = await must(q, table);
  console.log(`${label.padEnd(46)} ${rows.length}`);
  total += rows.length;
  for (const r of rows.slice(0, 6)) {
    console.log(`      ${r.action ?? r.title ?? r.status ?? r.id}`);
    if (r.action_url) console.log(`          action_url: ${r.action_url}`);
    if (r.body) console.log(`          body: ${String(r.body).slice(0, 130).replace(/\s+/g, " ")}`);
    if (r.created_at) console.log(`          at ${r.created_at}`);
  }
  if (rows.length > 6) console.log(`      … and ${rows.length - 6} more`);
}

console.log(`\ntotal rows still referencing the deleted period: ${total}`);
if (total === 0) {
  console.log("Nothing references it. The failing link must be being produced by the crawl itself\n" +
    "or by a table not in this list — check what `qa-exercise-internal-links.mjs` reads.");
}