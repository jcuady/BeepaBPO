// Does site_settings exist? upsertAboutPage writes to it, and the previous probe
// returned an error there rather than a count. A failed read and an empty table
// are indistinguishable unless the error is printed.
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

for (const t of ["site_settings", "settings", "app_settings", "cms_settings"]) {
  const { data, error } = await db.from(t).select("*").limit(3);
  if (error) { console.log(`${t.padEnd(16)} ERROR ${error.code}: ${error.message}`); continue; }
  console.log(`${t.padEnd(16)} ok, ${(data ?? []).length} sample row(s)`);
  if (data?.length) console.log("               ", JSON.stringify(data[0]).slice(0, 200));
}

// What about-setting key does the app look for?
const { data: about } = await db.from("site_settings").select("*").eq("key", "public_about").maybeSingle();
console.log("\npublic_about row:", about ? JSON.stringify(about).slice(0, 200) : "(none)");

// Enumerate real relations so the CMS exercise queries tables that exist.
const { data: rels, error: e2 } = await db.rpc("list_tables");
if (e2) {
  console.log("\n(list_tables unavailable, trying information_schema)");
} else {
  console.log(`\nrelations: ${(rels ?? []).length}`);
  const names = (rels ?? []).map((r) => r.table_name ?? r.name).filter(Boolean).sort();
  for (const n of names) if (/setting|about|cms/i.test(n)) console.log(`  ${n}`);
}