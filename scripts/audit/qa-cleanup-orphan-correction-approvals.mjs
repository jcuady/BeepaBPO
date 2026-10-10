// Remove approval_requests that no longer have an entity behind them.
//
// WHY: an earlier attendance exercise deleted the attendance_correction_requests
// rows it created but failed to record their approval_requests ids, so two
// approvals were left pointing at corrections that no longer exist. Nothing in
// the app reads an approval without its entity, but an orphan in a table the
// approvals page counts is residue a real user could see.
//
// SAFE: only deletes an approval whose entity_id has no matching row in
// attendance_correction_requests. Dry run unless --apply is passed.

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
const APPLY = process.argv.includes("--apply");

const { data: approvals, error } = await db
  .from("approval_requests")
  .select("id, entity_type, entity_id, status, created_at")
  .eq("entity_type", "attendance_correction");
if (error) throw new Error(error.message);

const { data: corrections, error: e2 } = await db
  .from("attendance_correction_requests").select("id");
if (e2) throw new Error(e2.message);

const live = new Set((corrections ?? []).map((c) => c.id));
const orphans = (approvals ?? []).filter((a) => !live.has(a.entity_id));

console.log(`attendance_correction approvals: ${(approvals ?? []).length}`);
console.log(`attendance_correction requests : ${live.size}`);
console.log(`orphaned approvals              : ${orphans.length}`);
for (const o of orphans) {
  console.log(`  ${o.id}  status=${o.status}  entity=${o.entity_id}  created=${o.created_at}`);
}

if (!orphans.length) {
  console.log("\nnothing to clean");
  process.exit(0);
}
if (!APPLY) {
  console.log("\ndry run — pass --apply to delete");
  process.exit(0);
}

for (const o of orphans) {
  const { error: delErr } = await db.from("approval_actions").delete().eq("request_id", o.id);
  if (delErr) { console.error(`  actions delete failed for ${o.id}: ${delErr.message}`); continue; }
  const { error: reqErr } = await db.from("approval_requests").delete().eq("id", o.id);
  if (reqErr) console.error(`  request delete failed for ${o.id}: ${reqErr.message}`);
  else console.log(`  deleted ${o.id}`);
}

const { data: after } = await db.from("approval_requests").select("id").eq("entity_type", "attendance_correction");
console.log(`\nattendance_correction approvals now: ${(after ?? []).length}`);