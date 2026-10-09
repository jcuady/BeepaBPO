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

// Wait for an actual SUBSCRIBED acknowledgement. Do NOT insert on a bare timer.
//
// The previous version raced: the subscribe promise resolved after a flat 2s
// whether or not the channel had confirmed, so the insert could land before the
// channel was live. It then waited a fixed 2.5s for the event. Under the release
// gate — which runs this straight after vitest and the live-data smoke step, on a
// loaded box — that was not enough, the event arrived late or not at all, and the
// probe reported "realtime BROKEN". verify-all then reported the canned
// "DB needs migration 20261006140000", which is already applied. So one gate run
// failed with a confident, false explanation for a system that was working.
//
// "We never finished subscribing" and "we subscribed and no event came" are
// different faults with different fixes, so they get different exit codes.
const SUBSCRIBE_TIMEOUT_MS = 15000;
let subscribeStatus = null;
const didSubscribe = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve(false), SUBSCRIBE_TIMEOUT_MS);
  channel.subscribe((status) => {
    subscribeStatus = status;
    if (status === "SUBSCRIBED") {
      clearTimeout(timer);
      resolve(true);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      clearTimeout(timer);
      resolve(false);
    }
  });
});

if (!didSubscribe) {
  console.error(
    `PROBE_RESULT=NOT_SUBSCRIBED\n` +
      `the channel never reached SUBSCRIBED (last status: ${subscribeStatus ?? "none"}, ` +
      `waited ${SUBSCRIBE_TIMEOUT_MS}ms). That is a transport/websocket failure and says ` +
      `nothing about whether the DB is publishing. No insert was attempted.`,
  );
  sbAnon.removeChannel(channel);
  process.exit(3);
}
console.log("subscribed OK (channel acknowledged)");
// Realtime needs a moment after the ack before the server will start streaming
// changes; inserting in the same tick can still race the subscription.
await new Promise((r) => setTimeout(r, 500));

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

// Poll for the event instead of sampling once. The delivery path is
// insert -> WAL -> realtime server -> websocket -> client; none of those legs are
// synchronous, and their latency is load-dependent.
const DELIVERY_TIMEOUT_MS = 15000;
const deadline = Date.now() + DELIVERY_TIMEOUT_MS;
while (!fired && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 250));
}

if (fired) {
  console.log(`\nResult: ✓ realtime WORKS (event arrived within ${DELIVERY_TIMEOUT_MS}ms budget)`);
  console.log("PROBE_RESULT=OK");
} else {
  console.log(`\nResult: ✗ realtime DELIVERY FAILED — subscribed, row inserted, no event within ${DELIVERY_TIMEOUT_MS}ms`);
  console.log("PROBE_RESULT=DELIVERY_FAILED");
}

await sbAdmin.from("notifications").delete().eq("id", ins.id);
sbAnon.removeChannel(channel);
process.exit(fired ? 0 : 1);