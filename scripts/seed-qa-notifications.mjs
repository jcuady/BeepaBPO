#!/usr/bin/env node
// Seed a populated, CORRECT notification inbox from entities that actually exist.
//
// WHY: clearing the 27 orphaned rows and making the workflow exercises
// self-cleaning left `notifications` empty, which the population audit flags as
// EMPTY. An empty inbox is honest but it means nobody has ever seen the feature
// working with data, and the P0 fix for the generic leave body has nothing left
// on screen to demonstrate it.
//
// Every row here is derived from a LIVE record — a real leave_requests row or a
// real tickets row — and the bodies are built by the SAME functions the app
// calls (`lib/leave/notification-body.ts`), imported directly rather than
// reimplemented. Duplicating that logic is what produced the
// "Your 3 days of leave (Oct 30 - Nov 1). was approved by Demo HR." grammar bug
// earlier, so it is not reimplemented here.
//
// IDEMPOTENT: keyed on (user_id, type, entity_id, body). Re-running inserts 0.
//
// DRY RUN BY DEFAULT.
//
// Usage:
//   node scripts/seed-qa-notifications.mjs
//   node scripts/seed-qa-notifications.mjs --apply

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  buildLeaveDecisionNotificationBody,
  buildLeaveRequestNotificationBody,
} from "../lib/leave/notification-body.ts";

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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function die(m) { console.error(m); process.exit(1); }
async function must(promise, what) {
  const { data, error } = await promise;
  if (error) die(`${what} failed: ${error.message}`);
  if (data === null) die(`${what} returned null — refusing to continue`);
  return data;
}

// ---- team leads, matching lib/leave/actions.ts distribution ----
const memberships = await must(db.from("organization_memberships").select("id, user_id"), "memberships");
const mRoles = await must(db.from("membership_roles").select("membership_id, role_id"), "membership_roles");
const roles = await must(db.from("roles").select("id, code"), "roles");
const leadRoleIds = new Set(roles.filter((r) => r.code === "team_lead").map((r) => r.id));
const teamLeadIds = memberships.filter((m) => mRoles.some((mr) => mr.membership_id === m.id && leadRoleIds.has(mr.role_id))).map((m) => m.user_id);
console.log(`team leads: ${teamLeadIds.length}`);

const profiles = await must(db.from("profiles").select("id, first_name, last_name, display_name"), "profiles");
// The app passes `workspace.profile.display_name` into the builder, so use the
// same field here or seeded rows would not match what the app actually sends.
// `employees` has no name columns at all — names live on `profiles`.
const profileName = new Map(
  profiles.map((p) => [
    p.id,
    p.display_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" "),
  ]),
);
const employees = await must(db.from("employees").select("id, profile_id"), "employees");
const employeeById = new Map(employees.map((e) => [e.id, e]));
const leaveTypes = await must(db.from("leave_types").select("id, name"), "leave_types");
const typeName = new Map(leaveTypes.map((t) => [t.id, t.name]));

const existing = await must(db.from("notifications").select("id, user_id, type, entity_id, body"), "notifications");
const seen = new Set(existing.map((n) => `${n.user_id}|${n.type}|${n.entity_id}|${n.body}`));

const rows = [];
const add = (r) => {
  const key = `${r.user_id}|${r.type}|${r.entity_id}|${r.body}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(r);
};

// ---- leave.request -> team leads ----
const leaves = await must(
  db.from("leave_requests").select("id, employee_id, leave_type_id, start_at, end_at, status, reason"),
  "leave_requests",
);
for (const lr of leaves) {
  if (/^QA workflow exercise/i.test(lr.reason ?? "")) continue;
  const emp = employeeById.get(lr.employee_id);
  const requesterName = emp ? profileName.get(emp.profile_id) : null;
  const body = buildLeaveRequestNotificationBody({
    requesterName,
    leaveTypeName: typeName.get(lr.leave_type_id),
    startDate: lr.start_at,
    endDate: lr.end_at,
  });
  for (const uid of teamLeadIds) {
    add({
      user_id: uid, type: "leave.request", title: "Leave request pending",
      body, action_url: "/app/leave", entity_type: "leave_request", entity_id: lr.id,
    });
  }

  // ---- leave.decision -> the employee, once the workflow has finished ----
  if (lr.status === "approved" || lr.status === "rejected" || lr.status === "manager_approved") {
    const approved = lr.status !== "rejected";
    const target = emp?.profile_id;
    if (target) {
      add({
        user_id: target,
        type: "leave.decision",
        title: approved ? "Leave approved" : "Leave rejected",
        body: buildLeaveDecisionNotificationBody({
          startDate: lr.start_at, endDate: lr.end_at,
          leaveTypeName: typeName.get(lr.leave_type_id), approved,
        }),
        action_url: "/app/my/leave", entity_type: "leave_request", entity_id: lr.id,
      });
    }
  }
}

// ---- ticket.created -> requester, ticket.assigned -> assignee ----
const tickets = await must(
  db.from("tickets").select("id, ticket_number, subject, requester_user_id, assigned_user_id, status"),
  "tickets",
);
for (const t of tickets) {
  if (/^QA ticket exercise/i.test(t.subject ?? "")) continue;
  if (t.requester_user_id) {
    add({
      user_id: t.requester_user_id, type: "ticket.created", title: "Ticket submitted",
      body: `We received your request: ${t.subject}`, action_url: "/app/tickets",
      entity_type: "ticket", entity_id: t.id,
    });
  }
  if (t.assigned_user_id && t.assigned_user_id !== t.requester_user_id) {
    add({
      user_id: t.assigned_user_id, type: "ticket.assigned", title: "Ticket assigned to you",
      body: `${t.ticket_number}: ${t.subject}`, action_url: `/app/tickets/${t.id}`,
      entity_type: "ticket", entity_id: t.id,
    });
  }
}

const byType = {};
for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
console.log(`\n${rows.length} notification(s) to insert:`, byType);
console.log(`\nsample bodies:`);
for (const t of Object.keys(byType)) {
  const s = rows.find((r) => r.type === t);
  if (s) console.log(`  [${t}] ${s.body}`);
}

if (!APPLY) {
  console.log("\nDRY RUN — re-run with --apply to insert. Nothing has been changed.");
} else {
  const { error, count } = await db.from("notifications").insert(rows, { count: "exact" });
  if (error) die(`insert failed: ${error.message}`);
  console.log(`\ninserted ${count ?? rows.length} row(s)`);
  const after = await must(db.from("notifications").select("id, type"), "verification read");
  const t = {};
  for (const n of after) t[n.type] = (t[n.type] ?? 0) + 1;
  console.log(`notifications now: ${after.length}`, t);
}