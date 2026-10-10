// Does `owner` actually hold cms.manage at runtime? The table join said no, but
// the app resolves permissions through the user_permission_codes RPC, which can
// apply grants the table does not express. Sign in as owner and ask the RPC.
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

for (const who of ["owner", "marketing", "superadmin", "hr", "sales"]) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({
    email: `${who}@demo.beepabpo.com`,
    password: env.DEMO_PASSWORD,
  });
  if (error) { console.log(`${who.padEnd(12)} sign-in failed: ${error.message}`); continue; }
  const { data: codes, error: e2 } = await c.rpc("user_permission_codes");
  if (e2) { console.log(`${who.padEnd(12)} rpc error: ${e2.message}`); continue; }
  const list = codes ?? [];
  console.log(
    `${who.padEnd(12)} ${String(list.length).padStart(2)} permissions  cms.manage=${list.includes("cms.manage") ? "YES" : "no "}  system.manage=${list.includes("system.manage") ? "YES" : "no"}`,
  );
  void data;
}