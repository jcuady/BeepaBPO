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
// Fall back to the legacy key, as every other Supabase script in this repo does.
// Hard-depending on SUPABASE_SECRET_KEY alone meant this was the one script that
// broke outright when only SERVICE_ROLE was configured, and it took down ship
// gate step 16 with a bare "supabaseKey is required".
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("no Supabase privileged key found (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
process.env.SUPABASE_SECRET_KEY = "[redacted]";

const sbAdmin = createClient(URL, KEY, { auth: { persistSession: false } });

// Pick a demo user (HR)
const { data: hr } = await sbAdmin.from("profiles").select("id, display_name").ilike("display_name", "%HR%").maybeSingle();
const userId = hr?.id;
if (!userId) { console.error("no HR profile found"); process.exit(1); }
console.log(`Testing realtime for HR user ${hr.display_name} (${userId})`);

// Subscribe AS the user who owns the notification, not as anon.
//
// `notifications` has RLS `user_id = auth.uid()` scoped to the `authenticated`
// role, so an anon subscriber is filtered out of every row and can never receive
// the event this probe is trying to observe. The previous version subscribed
// with the anon key and then reported "realtime BROKEN" — but it was structurally
// incapable of passing, with or without the realtime publication. The realistic
// case, and the one the app actually relies on, is an authenticated subscriber.
const sbAnon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const HR_EMAIL = process.env.REALTIME_PROBE_EMAIL ?? "hr@demo.beepabpo.com";
const password = process.env.DEMO_PASSWORD;
if (!password) {
  console.error("DEMO_PASSWORD is required: the probe must subscribe as an authenticated user");
  process.exit(2);
}

/**
 * Sign in, retrying on a rate limit.
 *
 * Subscribing as a real user is what makes this probe meaningful, but it also
 * makes the probe spend a password grant, and Supabase throttles those per IP.
 * The gate runs this right after other Supabase-touching steps, so a 429 here
 * reads exactly like broken realtime and turns a green gate red at random. A 429
 * is an environment condition, not a delivery failure, so it is retried rather
 * than reported as "realtime BROKEN".
 */
async function signInWithRetry(email, pass, attempts = 4) {
  for (let i = 1; i <= attempts; i += 1) {
    const { data, error } = await sbAnon.auth.signInWithPassword({ email, password: pass });
    if (!error) return data;
    const rateLimited = /rate|too many|429|security purposes/i.test(error.message);
    if (!rateLimited) throw new Error(`could not sign in as ${email}: ${error.message}`);
    if (i === attempts) {
      throw new Error(
        `could not sign in as ${email} after ${attempts} attempts (rate limited): ${error.message}. ` +
          "This is Supabase throttling password grants, NOT a realtime failure; rerun once the limit clears.",
      );
    }
    const waitMs = i * 4000;
    console.log(`rate limited on attempt ${i}; waiting ${waitMs / 1000}s`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error("unreachable");
}

const { user: signedInUser, error: signInError } = await signInWithRetry(HR_EMAIL, password).then(
  (d) => ({ user: d.user, error: null }),
  (e) => ({ user: null, error: e }),
);
if (signInError) {
  console.error(`[${signInError.message}]`);
  process.exit(2);
}
const signedIn = { user: signedInUser };
console.log(`Subscribing as ${signedIn.user.email} (${signedIn.user.id})`);

if (signedIn.user.id !== userId) {
  console.error(
    `subscribed user ${signedIn.user.id} does not match the notification owner ${userId}; ` +
      "the probe would pass or fail for the wrong reason",
  );
  process.exit(2);
}

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