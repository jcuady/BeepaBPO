// Confirm realtime events actually fire by inserting a test row
// and watching for the postgres_changes callback.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, idx).trim()] = v;
}
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = "[redacted]";

const sbAdmin = createClient(URL, KEY, { auth: { persistSession: false } });

// Pick a demo user (HR)
const { data: hr } = await sbAdmin.from("profiles").select("id, display_name").ilike("display_name", "%HR%").maybeSingle();
const userId = hr?.id;
if (!userId) { console.error("no HR profile found"); process.exit(1); }
console.log(`Testing realtime for HR user ${hr.display_name} (${userId})`);

const sbAnon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let fired = false;
const channel = sbAnon
  .channel(`probe-events:${Date.now()}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
    (payload) => {
      fired = true;
      console.log("[REALTIME] notification received:", JSON.stringify(payload, null, 2).slice(0, 200));
    },
  );

await new Promise((resolve) => {
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") { console.log("subscribed OK"); resolve(); }
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { console.log("sub error", status); resolve(); }
  });
  setTimeout(resolve, 2000);
});

console.log("Inserting test notification...");
const { data: ins, error } = await sbAdmin.from("notifications").insert({
  user_id: userId,
  type: "test.realtime",
  title: "Realtime test",
  body: "If you can read this, realtime works.",
  action_url: "/app/my/notifications",
}).select("id").single();

if (error) { console.error("insert failed:", error.message); process.exit(1); }
console.log(`Inserted: ${ins.id}`);

await new Promise((r) => setTimeout(r, 2500));
console.log(`\nResult: ${fired ? "✓ realtime WORKS" : "✗ realtime BROKEN — event did not arrive"}`);

await sbAdmin.from("notifications").delete().eq("id", ins.id);
sbAnon.removeChannel(channel);
process.exit(fired ? 0 : 1);