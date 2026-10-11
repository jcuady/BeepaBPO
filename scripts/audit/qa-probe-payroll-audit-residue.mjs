// Which audit rows does the payroll exercise leave behind?
//
// The payroll exercise creates its own `payroll_periods` row and deletes it in `finally`,
// but it never touched `audit_logs`. Anything the run wrote therefore survives, pointing at
// a period that no longer exists. This prints those rows, and every other audit row in the
// same table, so the residue is identified rather than assumed -- and so the cleanup can be
// scoped to the exact shape rather than to a guess.
//
// Read-only.
//
// Usage: node scripts/audit/qa-probe-payroll-audit-residue.mjs

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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const must = async (p, what) => {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
};

const periods = await must(db.from("payroll_periods").select("id"), "periods");
const records = await must(db.from("payroll_records").select("id"), "records");
console.log(`live payroll_periods: ${periods.length}   live payroll_records: ${records.length}`);

const all = await must(
  db.from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, actor_user_id")
    .in("entity_type", ["payroll_period", "payroll_record"])
    .order("created_at", { ascending: true }),
  "audit",
);

// Each entity_type must be checked against ITS OWN table. The first version of this probe
// compared every `entity_id` against live PERIOD ids, which made all three `payroll_record`
// rows look dangling when the question had never been asked of the right table. That is the
// same class of mistake this QA effort has been retracting all along -- a wrong id set turns
// live audit history into an apparently safe deletion target.
const liveByType = {
  payroll_period: new Set(periods.map((p) => p.id)),
  payroll_record: new Set(records.map((r) => r.id)),
};

console.log(`\naudit rows for payroll entities: ${all.length}`);
const dangling = all.filter((a) => !liveByType[a.entity_type]?.has(a.entity_id));
console.log(`\nDANGLING (entity_id is not a live row in its own table): ${dangling.length}`);
for (const d of dangling) {
  console.log(`  ${d.created_at}  ${d.action}  ${d.entity_type}  entity_id=${d.entity_id}`);
  console.log(`      audit id=${d.id}`);
}

const live = all.filter((a) => liveByType[a.entity_type]?.has(a.entity_id));
console.log(`\nreferencing a live row (leave alone): ${live.length}`);
for (const l of live) console.log(`  ${l.created_at}  ${l.action}  ${l.entity_type}  entity_id=${l.entity_id}`);

// Every distinct action in the table, so the cleanup's allow-list can be written against
// what the product actually writes rather than against what was seen once.
const everything = await must(db.from("audit_logs").select("action, entity_type"), "all audit");
const byType = new Map();
for (const r of everything) {
  const key = `${r.entity_type ?? "(null)"} :: ${r.action}`;
  byType.set(key, (byType.get(key) ?? 0) + 1);
}
console.log(`\nall audit action/entity_type combinations (${byType.size}):`);
for (const [k, v] of [...byType.entries()].sort()) console.log(`  ${String(v).padStart(4)}  ${k}`);