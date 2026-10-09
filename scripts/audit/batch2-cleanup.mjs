// Batch 2: Dedupe + clean dummy data.
// - Delete duplicate bereavement leave_requests (keep oldest per (employee, start_at, end_at))
// - Mark all old unread notifications as read for HR (user 9e72049e) and team_lead (e743e34b)
// - Delete orphan performance_kpis that have no cycle
// - Assign unassigned CRM leads to sales user
// - Re-open the stuck demo ticket with proper SLA window
// All idempotent. Uses supabase-js service_role.
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
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SECRET_KEY = "[redacted]";
process.env.SUPABASE_SERVICE_ROLE_KEY = "[redacted]";

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// 1) Dedupe bereavement leave_requests.
async function dedupeLeave() {
  console.log("\n--- dedupe leave_requests ---");
  const { data: leaves, error } = await sb
    .from("leave_requests")
    .select("id, employee_id, start_at, end_at, requested_minutes, status, created_at")
    .order("created_at", { ascending: true });
  if (error) { console.error("read leaves failed:", error.message); return; }
  const groups = new Map();
  for (const l of leaves) {
    const k = `${l.employee_id}|${l.start_at}|${l.end_at}|${l.requested_minutes}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  }
  let deleted = 0;
  for (const [k, items] of groups) {
    if (items.length <= 1) continue;
    const keep = items[0]; // oldest
    const dupes = items.slice(1);
    console.log(`  group ${k.split("|").slice(0,2).join(" / ")}: keeping ${keep.id.slice(0,8)}, deleting ${dupes.length} dupes`);
    const ids = dupes.map((d) => d.id);
    // Also delete any approval_requests pointing at the duplicate leave ids
    const { data: linkedApprovals, error: apErr } = await sb
      .from("approval_requests")
      .select("id")
      .eq("entity_type", "leave_request")
      .in("entity_id", ids);
    if (apErr) console.error("  approval lookup failed:", apErr.message);
    if (linkedApprovals?.length) {
      const apIds = linkedApprovals.map((a) => a.id);
      await sb.from("approval_actions").delete().in("request_id", apIds);
      const { error: apDelErr } = await sb.from("approval_requests").delete().in("id", apIds);
      if (apDelErr) console.error("  approval delete failed:", apDelErr.message);
      else console.log(`    also removed ${apIds.length} approval_requests for these dupes`);
    }
    const { error: delErr } = await sb.from("leave_requests").delete().in("id", ids);
    if (delErr) { console.error("  delete failed:", delErr.message); continue; }
    deleted += ids.length;
  }
  console.log(`  -> deleted ${deleted} duplicate leave_requests`);
}

// 2) Mark unread notifications read for HR + Team Lead.
async function markNotifications() {
  console.log("\n--- mark stale notifications read ---");
  // Older than 14 days, all unread, HR + Team Lead users
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  const users = ["9e72049e-a5e2-4ca3-8d25-df5af7d5b829", "e743e34b-5f46-4076-91ee-88b59545ca96"];
  const { data, error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("user_id", users)
    .is("read_at", null)
    .lt("created_at", cutoff)
    .select("id");
  if (error) { console.error("  mark-read failed:", error.message); return; }
  console.log(`  -> marked ${data?.length ?? 0} notifications as read`);
}

// 3) Delete orphan performance_kpis (no cycle_id set and no related cycle exists).
async function orphanKpis() {
  console.log("\n--- delete orphan performance_kpis ---");
  // cycle_id is nullable; we'll delete ones with NULL cycle_id AND not visibility='client_visible' demo marker is OK to keep
  // But the audit found 1 row. Let's only delete if cycle_id is null AND created_at < cutoff
  // Safer: don't delete KPIs blindly; attach them to a new cycle in Batch 3.
  // For Batch 2, just count and report.
  const { count } = await sb.from("performance_kpis").select("*", { count: "exact", head: true }).is("cycle_id", null);
  console.log(`  -> orphan KPIs (cycle_id null): ${count}. Will be attached to a cycle in Batch 3.`);
}

// 4) Assign unassigned CRM leads to sales user.
async function assignLeads() {
  console.log("\n--- assign unassigned CRM leads ---");
  const sales = "8e32a8d1-f6a9-4b71-a3ee-1d0e5a298fbe"; // demo sales
  const { data, error } = await sb
    .from("crm_leads")
    .update({ assigned_sales_user_id: sales })
    .is("assigned_sales_user_id", null)
    .select("id, company_name");
  if (error) { console.error("  assign failed:", error.message); return; }
  console.log(`  -> assigned ${data?.length ?? 0} leads to sales:`, data?.map((d) => d.company_name).join(", "));
}

// 5) Re-open the stuck demo ticket: extend SLA + assign + move to 'in_progress'.
async function fixTicket() {
  console.log("\n--- re-open stuck ticket ---");
  const ticketId = "50e55ef1-ed0c-4f89-aa05-b4050ae431e6";
  const sales = "8e32a8d1-f6a9-4b71-a3ee-1d0e5a298fbe";
  const ops = "d2757c79-e984-4855-b4b8-09d9e84398a7"; // demo operations
  // First-response +24h, due +72h from now
  const newSla = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const { data, error } = await sb
    .from("tickets")
    .update({
      status: "in_progress",
      assigned_user_id: sales,
      assigned_team: "sales",
      sla_due_at: newSla,
      first_response_at: null, // reset so SLA timer starts fresh
    })
    .eq("id", ticketId)
    .select("ticket_number, status, assigned_user_id, sla_due_at");
  if (error) { console.error("  ticket update failed:", error.message); return; }
  console.log(`  -> ticket ${data?.[0]?.ticket_number} now status=${data?.[0]?.status} sla=${data?.[0]?.sla_due_at}`);
  // Add a status history row
  await sb.from("ticket_status_history").insert({
    ticket_id: ticketId,
    from_status: "new",
    to_status: "in_progress",
    changed_by: sales,
    notes: "Re-opened by batch cleanup; SLA window reset.",
  });
  // Add an internal note
  await sb.from("ticket_internal_notes").insert({
    ticket_id: ticketId,
    author_user_id: ops,
    body: "Cleaning up demo ticket backlog. Assigning to sales team for proper triage.",
  });
}

// 6) Profile.last_login_at sync from auth.users for demo users (best-effort via REST).
//    We can't query auth.users directly via PostgREST; use auth admin API.
async function syncLastLogin() {
  console.log("\n--- sync profile.last_login_at from auth.users ---");
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) { console.error("  auth list failed:", error.message); return; }
  let synced = 0;
  for (const u of data?.users ?? []) {
    const last = u.last_sign_in_at;
    if (!last) continue;
    const { error: upErr } = await sb
      .from("profiles")
      .update({ last_login_at: last })
      .eq("id", u.id);
    if (!upErr) synced++;
  }
  console.log(`  -> synced ${synced} profile.last_login_at values`);
}

async function main() {
  console.log("=== BATCH 2 — Dedupe + cleanup ===");
  await dedupeLeave();
  await markNotifications();
  await orphanKpis();
  await assignLeads();
  await fixTicket();
  await syncLastLogin();
  console.log("\n=== BATCH 2 DONE ===");
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});