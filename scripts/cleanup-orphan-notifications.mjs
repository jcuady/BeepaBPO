#!/usr/bin/env node
// Remove notifications whose subject record no longer exists.
//
// WHY: every `leave.request` notification written before the rewrite carries the
// body "A team member submitted a leave request for review." — naming no person,
// no leave type, no dates. 27 such rows had accumulated, addressed to two demo
// users. Worse, all 27 point at a `leave_requests` row that no longer exists, so
// they are not merely uninformative but DEAD: opening one leads nowhere, and
// there is nothing left to reconstruct a correct body from.
//
// The code defect is fixed (lib/leave/notification-body.ts). This clears the
// rows the fix cannot reach — a code fix never rewrites history.
//
// SCOPE — deliberately narrow. A row is only a candidate if it satisfies BOTH:
//   1. entity_type = 'leave_request' AND its entity_id does NOT resolve to a
//      live leave_requests row (it is a dead link), AND
//   2. its body is exactly the legacy generic string.
//
// An orphaned row carrying real, identifying text is NOT deleted — it is
// reported for review, because that would be data worth keeping and not a
// defect worth clearing.
//
// DRY RUN BY DEFAULT.
//
// Usage:
//   node scripts/cleanup-orphan-notifications.mjs
//   node scripts/cleanup-orphan-notifications.mjs --apply

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

const APPLY = process.argv.includes("--apply");
const LEGACY_BODY = "A team member submitted a leave request for review.";
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// Every read checks `error`. A select against a column or table that does not
// exist returns `data: null` AND an error without throwing — which reads
// exactly like "nothing found". `start_at`/`end_at` are the real column names
// on leave_requests, not `start_date`/`end_date`; selecting the wrong one here
// would silently report zero orphans and clear nothing.
const { data: notifs, error: nErr } = await db
  .from("notifications")
  .select("id, user_id, type, title, body, entity_type, entity_id, created_at");
if (nErr) die(`could not read notifications: ${nErr.message}`);
if (!notifs?.length) die("notifications table came back empty — refusing to report 'nothing to clean'");

const { data: liveLeave, error: lErr } = await db
  .from("leave_requests")
  .select("id")
  .limit(5000);
if (lErr) die(`could not read leave_requests: ${lErr.message}`);

const liveIds = new Set((liveLeave ?? []).map((r) => r.id));
console.log(`read ${notifs.length} notification(s); ${liveIds.size} live leave_request(s)`);

const dead = (notifs ?? []).filter(
  (n) => n.entity_type === "leave_request" && n.entity_id && !liveIds.has(n.entity_id),
);
const generic = dead.filter((n) => n.body === LEGACY_BODY);
const valuable = dead.filter((n) => n.body !== LEGACY_BODY);

console.log(`\ndead-linked leave.request notifications: ${dead.length}`);
console.log(`  ...carrying the legacy generic body : ${generic.length}  <- candidates for removal`);
console.log(`  ...carrying real identifying text  : ${valuable.length}  <- REVIEW, not deleted`);

if (valuable.length) {
  console.log("\nNOT being deleted (dead link but real content — needs a human decision):");
  for (const r of valuable) {
    console.log(`  ${r.created_at}  body="${String(r.body).slice(0, 80)}"`);
  }
}

if (!generic.length) {
  console.log("\nnothing to clean");
} else {
  const byBody = new Map();
  for (const r of generic) byBody.set(r.body, (byBody.get(r.body) ?? 0) + 1);
  console.log(`\n${generic.length} candidate(s), all with body: ${JSON.stringify([...byBody])}`);
  console.log(`date range: ${generic.map((r) => r.created_at).sort()[0]} .. ${generic.map((r) => r.created_at).sort().at(-1)}`);

  if (!APPLY) {
    console.log("\nDRY RUN — re-run with --apply to delete. Nothing has been changed.");
  } else {
    const ids = generic.map((r) => r.id);
    const { error: delErr, count } = await db
      .from("notifications")
      .delete({ count: "exact" })
      .in("id", ids);
    if (delErr) die(`delete failed: ${delErr.message}`);
    console.log(`\ndeleted ${count ?? ids.length} row(s)`);

    // Verify by re-reading, not by trusting the delete's own count.
    const { data: after, error: aErr } = await db
      .from("notifications")
      .select("id, body, entity_type, entity_id")
      .eq("body", LEGACY_BODY);
    if (aErr) die(`verification read failed: ${aErr.message}`);
    const stillDead = (after ?? []).filter((n) => n.entity_id && !liveIds.has(n.entity_id));
    console.log(`legacy-body rows remaining: ${(after ?? []).length}`);
    console.log(`of those, still dead-linked: ${stillDead.length}`);
    if (stillDead.length) die(`verification FAILED: ${stillDead.length} dead rows survived the delete`);
    console.log("verified: no dead-linked legacy notification remains");
  }
}