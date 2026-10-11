// Confirm the realtime probes left no notification rows behind.
//
// Both the gate run and an isolated run inserted a notification. `test-realtime-events.mjs`
// deletes its row on every path, including the DELIVERY_FAILED branch -- which does NOT
// exit early, so a failing gate should still clean up. That is worth checking rather than
// assuming, because a probe that leaks a row on failure makes the next run's counts drift
// and gives a real leak somewhere to hide.
//
// Usage: node scripts/audit/qa-check-realtime-residue.mjs

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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// The ids printed by the two runs this session.
const IDS = [
  "04c670c3-31de-4aae-8074-beaec47ca20d", // gate run (failed delivery)
  "518e2b45-bb81-4871-9dbd-905fa3878090", // isolated run (delivered in 290ms)
];

const { data, error } = await admin
  .from("notifications").select("id, title, created_at").in("id", IDS);
if (error) throw new Error(`read: ${error.message}`);

console.log(`notifications table holds ${data.length} of the ${IDS.length} probe row(s) checked`);
for (const id of IDS) {
  const hit = data.find((r) => r.id === id);
  console.log(`  ${hit ? `STILL PRESENT (${hit.title})` : "cleaned up"}  ${id}`);
}

// Also look for anything the probe titles recognisably, in case an older run leaked.
const { data: strays } = await admin
  .from("notifications").select("id, title, created_at")
  .ilike("title", "%realtime%")
  .order("created_at", { ascending: false })
  .limit(10);
console.log(`\nrows whose title mentions "realtime": ${strays?.length ?? 0}`);
for (const s of strays ?? []) console.log(`  ${s.id.slice(0, 8)}  ${s.created_at}  ${s.title}`);

process.exitCode = data.length ? 1 : 0;