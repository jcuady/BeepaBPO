// Test which tables are in the supabase_realtime publication by trying to
// subscribe to each via postgres_changes. If the table isn't in the
// publication, the subscription either errors immediately or never fires.
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
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "[redacted]";
process.env.SUPABASE_SECRET_KEY = "[redacted]";

const sb = createClient(URL, ANON, { auth: { persistSession: false } });

const TABLES = [
  "attendance_records",
  "crm_leads",
  "crm_deals",
  "tickets",
  "job_applications",
  "leave_requests",
  "notifications",
  "approval_requests",
  "payroll_records",
  "cash_advance_requests",
  "nte_cases",
  "ticket_messages",
  "ticket_internal_notes",
  "tickets_status_history",
  "job_applications_history",
  "leave_balances",
  "performance_kpis",
  "audit_logs",
];

async function testTable(table) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (status) => {
      if (resolved) return;
      resolved = true;
      sb.removeChannel(channel);
      resolve(status);
    };
    const channel = sb.channel(`probe:${table}:${Date.now()}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => finish("fired"),
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setTimeout(() => finish("subscribed"), 500);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        finish(`error:${status}`);
      }
    });
    setTimeout(() => finish("timeout"), 2500);
  });
}

const results = [];
for (const t of TABLES) {
  process.stdout.write(`  ${t.padEnd(28)} `);
  const r = await testTable(t);
  process.stdout.write(r + "\n");
  results.push({ table: t, status: r });
}

console.log("\nSummary:");
for (const r of results) {
  const ok = r.status === "subscribed" || r.status === "fired";
  console.log(`  ${ok ? "✓" : "✗"} ${r.table.padEnd(28)} ${r.status}`);
}
const broken = results.filter((r) => r.status !== "subscribed" && r.status !== "fired");
console.log(`\n${broken.length} table(s) NOT in publication:`);
for (const r of broken) console.log(`  - ${r.table}`);