// Repoint ticket notifications that were addressed to a route their recipient
// cannot open.
//
// WHY
// `createTicket` and `assignTicket` both hardcoded the staff queue route on the
// notification. `/app/tickets` is guarded by `requireInternal`, so every client or
// applicant who raised or was assigned a ticket received an inbox item whose only
// link led to "Access not allowed". Found by `qa-exercise-internal-links.mjs`, which
// walks each role's reachable links and judges them by where they LAND.
//
// The generating code is fixed in lib/tickets/actions.ts via lib/notifications/
// ticket-route.ts. This script repairs the rows the old code already wrote, which a
// code fix cannot reach — they are data, not behaviour.
//
// WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT
// Only notifications whose recipient has a non-internal membership are touched, and
// only when their action_url starts with /app/tickets. It repoints the URL to the
// route that recipient can actually open:
//     client     -> /app/client/tickets[/{id}]
//     applicant  -> /app/my/requests[/{id}]
//     internal   -> unchanged
//
// Nothing is deleted and no row is created. If a row's membership cannot be resolved
// it is LEFT ALONE and reported, because guessing a recipient's role and rewriting
// their inbox is worse than leaving a visible defect.
//
// SAFE TO RE-RUN: idempotent. A second run finds nothing to change.
//
// Usage: node scripts/audit/qa-repair-notification-routes.mjs

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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

/** A record id, so a list route's last segment is never mistaken for one. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mirrors lib/notifications/ticket-route.ts. Keep the two in step. */
function ticketRouteFor(type, ticketId) {
  if (type === "client") return ticketId ? `/app/client/tickets/${ticketId}` : "/app/client/tickets";
  // Applicants have no ticket surface of their own; /app/my/requests is behind the
  // employee shell and redirects them to /app. See lib/notifications/ticket-route.ts.
  if (type === "applicant") return "/app/applicant";
  return ticketId ? `/app/tickets/${ticketId}` : "/app/tickets";
}

const { data: members, error: mErr } = await db
  .from("organization_memberships")
  .select("user_id, membership_type");
if (mErr) {
  console.error(`cannot read memberships: ${mErr.message}`);
  process.exit(1);
}
const typeByUser = new Map();
for (const m of members ?? []) typeByUser.set(m.user_id, m.membership_type);

// Two things can be wrong with a ticket notification's URL:
//   - it points at the STAFF route (/app/tickets...) for a non-internal recipient,
//     which is what the original bug wrote;
//   - it points at /app/my/requests, which exists and lists a user's own tickets but
//     sits behind the employee shell, so an applicant is redirected to /app and never
//     sees the ticket. An earlier version of this repair created that second mistake
//     itself, which is why the scan covers both shapes.
const { data: rows, error: nErr } = await db
  .from("notifications")
  .select("id, user_id, type, action_url, title")
  .or("action_url.like./app/tickets%,action_url.like./app/my/requests%");
if (nErr) {
  console.error(`cannot read notifications: ${nErr.message}`);
  process.exit(1);
}

const results = [];
const skipped = [];
for (const n of rows ?? []) {
  const type = typeByUser.get(n.user_id);
  if (!type) {
    skipped.push(`${n.type}: ${n.action_url} (recipient's membership unresolved)`);
    continue;
  }
  if (type === "internal") continue; // already correct

  const current = String(n.action_url);
  const id = current.split("/").pop();
  const isDetail = UUID_RE.test(id);
  // Only derive a ticket id from a URL that is already ticket-scoped. /app/my/requests
  // is a list, so its last segment is never an id.
  const ticketId = current.startsWith("/app/tickets/") && isDetail ? id : undefined;
  const want = ticketRouteFor(type, ticketId);
  if (want === current) continue;

  const { error: uErr } = await db.from("notifications").update({ action_url: want }).eq("id", n.id);
  if (uErr) {
    console.error(`FAILED ${n.id}: ${uErr.message}`);
    process.exitCode = 1;
    continue;
  }
  results.push(`${n.type} for a ${type}: ${n.action_url} -> ${want}`);
}

console.log(`scanned ${rows?.length ?? 0} notification(s) linking into /app/tickets`);
console.log(`repointed ${results.length}:`);
for (const r of results) console.log(`   ${r}`);
if (skipped.length) {
  console.log(`\nleft alone ${skipped.length} (cannot prove the recipient's role):`);
  for (const s of skipped) console.log(`   ${s}`);
}

// Verify by reading back, not by trusting the write.
const { data: after } = await db
  .from("notifications")
  .select("user_id, action_url")
  .or("action_url.like./app/tickets%,action_url.like./app/my/requests%");
const stillWrong = (after ?? []).filter((n) => {
  const t = typeByUser.get(n.user_id);
  return t && t !== "internal" && String(n.action_url).startsWith("/app/tickets");
});
const applicantStillWrong = (after ?? []).filter(
  (n) => typeByUser.get(n.user_id) === "applicant" && String(n.action_url).startsWith("/app/my/requests"),
);
console.log(
  stillWrong.length === 0
    ? "\nno non-internal recipient is left holding a staff ticket route"
    : `\nSTILL WRONG: ${stillWrong.length} row(s) remain`,
);
if (applicantStillWrong.length) {
  console.log(`STILL WRONG: ${applicantStillWrong.length} applicant row(s) still point at /app/my/requests`);
}
if (stillWrong.length || applicantStillWrong.length) process.exitCode = 1;