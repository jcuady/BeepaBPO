// Inspect the approval engine's real table shapes and whether the workflow that
// attendance corrections depend on actually exists.
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

for (const t of ["approval_workflows", "approval_steps", "approval_requests", "approval_actions"]) {
  const { data, error } = await db.from(t).select("*").limit(1);
  if (error) { console.log(`${t}: ERR ${error.message}`); continue; }
  const row = (data ?? [])[0];
  console.log(`${t}: ${data === null ? "no rows / inaccessible" : "columns = " + (row ? Object.keys(row).join(", ") : "(empty)")}`);
}

console.log("\n--- workflows ---");
const { data: wfs, error: e1 } = await db.from("approval_workflows").select("*");
if (e1) console.log("ERR", e1.message);
for (const w of wfs ?? []) console.log("  ", JSON.stringify(w));

console.log("\n--- steps ---");
const { data: steps, error: e2 } = await db.from("approval_steps").select("*");
if (e2) console.log("ERR", e2.message);
for (const s of steps ?? []) console.log("  ", JSON.stringify(s));