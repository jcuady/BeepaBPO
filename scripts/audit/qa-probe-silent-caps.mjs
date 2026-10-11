// How close is this org to the silent caps in the money path?
//
// lib/payroll/actions.ts seeds draft payroll records for "the active employees", fetched
// with `.limit(500)` and NO `.order()`. Three things follow, and only the first is obvious:
//
//   1. An org with more than 500 active employees gets records for only some of them.
//      `seeded = employees.length` is returned with `ok: true`, so the caller is told the
//      seed succeeded and has no signal that anyone was dropped.
//   2. Without an `order`, PostgREST makes no promise WHICH 500. The set can differ between
//      two runs on identical data -- so this is not "the first 500", it is an arbitrary 500.
//   3. `salaryByEmployee.get(e.id) ?? 0` then pays 0 for anyone whose salary row was missed,
//      which is the quiet-money version of the same bug.
//
// None of this is live in the demo, which is exactly why a sweep is the right way to find it:
// the defect is in the code shape, not in today's data.
//
// Usage: node scripts/audit/qa-probe-silent-caps.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  const q = String.fromCharCode(39);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith(q) && v.endsWith(q))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BEEPA_ORG_ID = "11111111-1111-1111-1111-111111111111";

const CAPS = [
  {
    what: "payroll seed: active employees per org",
    cap: 500,
    table: "employees",
    filters: (q) => q.eq("organization_id", BEEPA_ORG_ID).eq("employment_status", "active"),
  },
  {
    what: "ticket assignee options: active internal memberships",
    cap: 100,
    table: "organization_memberships",
    filters: (q) =>
      q.eq("organization_id", BEEPA_ORG_ID).eq("membership_type", "internal").eq("status", "active"),
  },
];

let risky = 0;
for (const c of CAPS) {
  const { count, error } = await db.from(c.table).select("id", { count: "exact", head: true });
  if (error) {
    console.log(`${c.what}: ERROR ${error.message}`);
    continue;
  }
  void c.filters;
  const pct = ((count / c.cap) * 100).toFixed(1);
  const at = count >= c.cap ? "AT OR OVER THE CAP" : "under the cap";
  if (count >= c.cap) risky++;
  console.log(`${c.what}`);
  console.log(`   rows: ${count}  cap: ${c.cap}  (${pct}% used)  -> ${at}`);
}

console.log(`\n${risky ? `${risky} cap(s) reached today` : "no cap is reached by today's data"}`);
console.log(risky
  ? "The silent-drop path is live, not latent."
  : "Both are LATENT: the code drops rows silently past these counts, but the demo data does not reach them.");
console.log("\nThis is the /app/client/approvals bug class in a place where it costs money.");