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

// ---- delivery attempt -------------------------------------------------------
//
// Three faults were being reported as one, and only the first two were separable:
//
//   never subscribed          -> the transport never came up        (exit 3)
//   subscribed, got no event  -> a delivery fault                    (exit 1)
//   subscribed, socket DIED, no event
//                            -> transport again, and NOT delivery
//
// The third is the one that actually bit. This step failed inside the release
// gate with "no event in 60000ms", while the same probe run on its own delivered
// in 262ms, 353ms and 523ms on three consecutive runs. Publication and
// subscription were both proven good independently: `test-realtime.mjs` subscribes
// cleanly to all 19 published tables, `notifications` among them.
//
// What the probe could not tell was whether its own channel was still alive when it
// inserted the row. supabase-js invokes the subscribe callback again on CLOSED,
// CHANNEL_ERROR and TIMED_OUT for the channel's whole lifetime, and this probe
// stopped listening after the first SUBSCRIBED — so a socket that died a second
// later was indistinguishable from an outage. That is the second time this step has
// failed with a confident and opposite explanation: an earlier version printed
// "realtime BROKEN" when it had merely raced, and the gate then reported a canned
// "DB needs migration 20261006140000", which is already applied.
//
// So: watch the status for the entire attempt, and retry once on a fresh channel
// before calling it an outage. An outage now means two channels in a row were
// healthy for their whole lives, an insert landed, and nothing came back.
const ATTEMPTS = 2;
const SUBSCRIBE_TIMEOUT_MS = 15000;
const DELIVERY_TIMEOUT_MS = 15000;
// A budget that expires is not the same thing as a system that is broken, so
// polling continues past the budget to a hard ceiling and the measured latency is
// reported. "Late" and "never" are different faults with different owners: one is a
// delivery latency regression worth blocking on, the other is realtime not working.
const HARD_CEILING_MS = 60000;

async function attempt(n) {
  let fired = false;
  let firedAt = null;
  let channelStatus = null;

  const channel = sbAnon
    .channel(`probe-events:${Date.now()}:${n}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => {
        fired = true;
        firedAt = Date.now();
        if (n === 1) console.log("[REALTIME] notification received:", JSON.stringify(payload).slice(0, 200));
      },
    );

  const didSubscribe = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), SUBSCRIBE_TIMEOUT_MS);
    channel.subscribe((status) => {
      channelStatus = status;
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
    console.log(`attempt ${n}: never reached SUBSCRIBED (last status: ${channelStatus ?? "none"})`);
    await sbAnon.removeChannel(channel);
    return { fired: false, latencyMs: null, late: false, channelStatus: channelStatus ?? "none", healthy: false };
  }
  console.log(`attempt ${n}: subscribed OK (channel acknowledged)`);

  // Realtime needs a moment after the ack before the server streams changes;
  // inserting in the same tick can still race the subscription.
  await new Promise((r) => setTimeout(r, 500));

  const { data: ins, error } = await sbAdmin.from("notifications").insert({
    user_id: userId,
    type: "test.realtime",
    title: "Realtime test",
    body: "If you can read this, realtime works.",
    action_url: "/app/my/notifications",
  }).select("id").single();

  if (error) {
    console.error("insert failed:", error.message);
    await sbAnon.removeChannel(channel);
    process.exit(1);
  }
  console.log(`attempt ${n}: inserted ${ins.id}`);

  const insertedAt = Date.now();
  let deadline = insertedAt + DELIVERY_TIMEOUT_MS;
  let late = false;
  while (!fired && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!fired) {
    deadline = insertedAt + HARD_CEILING_MS;
    while (!fired && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }
    late = fired;
  }
  const latencyMs = fired ? firedAt - insertedAt : null;

  // Read the status BEFORE tearing the channel down. `removeChannel` fires the
  // subscribe callback with CLOSED by design, so reading it afterwards reports
  // every healthy channel as closed — and then prints "CLOSED (healthy
  // throughout)", which is self-contradictory and, worse, would let a genuinely
  // healthy-but-silent channel be reported as an outage.
  const channelStatusAtEnd = channelStatus;
  const healthy = channelStatusAtEnd === "SUBSCRIBED";

  await sbAdmin.from("notifications").delete().eq("id", ins.id);
  await sbAnon.removeChannel(channel);
  return { fired, latencyMs, late, channelStatus: channelStatusAtEnd, healthy };
}

const runs = [];
for (let n = 1; n <= ATTEMPTS; n += 1) {
  const r = await attempt(n);
  runs.push(r);
  if (r.fired) break;
  console.log(
    `attempt ${n}: channel ended as ${r.channelStatus}${r.healthy ? " (healthy throughout)" : ""} with no event`,
  );
}
const final = runs[runs.length - 1];

if (final.fired && !final.late) {
  console.log(`\nResult: ✓ realtime WORKS (event delivered in ${final.latencyMs}ms, budget ${DELIVERY_TIMEOUT_MS}ms)`);
  console.log("PROBE_RESULT=OK");
  process.exit(0);
}
if (final.fired) {
  console.log(
    `\nResult: ⚠ realtime LATE — event delivered in ${final.latencyMs}ms, over the ${DELIVERY_TIMEOUT_MS}ms budget ` +
      `(waited up to ${HARD_CEILING_MS}ms). Realtime is working; the delivery is slow. ` +
      `This is a latency result, not an outage.`,
  );
  console.log("PROBE_RESULT=LATE");
  process.exit(4);
}
if (runs.some((r) => r.healthy)) {
  console.log(
    `\nResult: ✗ realtime DELIVERY FAILED — a channel stayed SUBSCRIBED for its whole life, ` +
      `${runs.length} insert(s) landed, and no event arrived within ${HARD_CEILING_MS}ms.`,
  );
  console.log("PROBE_RESULT=DELIVERY_FAILED");
  process.exit(1);
}
console.log(
  `\nResult: ✗ realtime CHANNEL UNSTABLE — no channel ever stayed SUBSCRIBED long enough to test ` +
    `delivery (statuses: ${runs.map((r) => r.channelStatus).join(", ")}). That is a websocket/transport ` +
    `fault, not a delivery outage, and it says nothing about the publication.`,
);
console.log("PROBE_RESULT=CHANNEL_UNSTABLE");
process.exit(3);