// Did the attendance exercise leave an approval_requests row behind, and what does
// an attendance_correction approval actually look like?
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

const { count } = await db.from("approval_requests").select("id", { count: "exact", head: true });
console.log(`approval_requests total: ${count}`);

const { data: ac, error } = await db
  .from("approval_requests")
  .select("id, entity_type, entity_id, status, current_step, workflow_id, created_at")
  .eq("entity_type", "attendance_correction")
  .order("created_at", { ascending: false })
  .limit(10);
if (error) throw new Error(error.message);
console.log(`attendance_correction approvals: ${(ac ?? []).length}`);
for (const r of ac ?? []) console.log("  ", JSON.stringify(r));

console.log("\nAll entity types present:");
const { data: all, error: e2 } = await db.from("approval_requests").select("entity_type, status").limit(500);
if (e2) throw new Error(e2.message);
const g = {};
for (const r of all ?? []) g[`${r.entity_type}/${r.status}`] = (g[`${r.entity_type}/${r.status}`] ?? 0) + 1;
console.log(" ", JSON.stringify(g, null, 2));

const { data: orphanActions, error: e3 } = await db
  .from("approval_actions").select("request_id").limit(1000);
if (e3) throw new Error(e3.message);
console.log(`approval_actions rows: ${(orphanActions ?? []).length}`);