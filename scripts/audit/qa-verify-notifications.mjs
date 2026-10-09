// Verifies the seeded notification inbox: distinctness, no dead links, no legacy bodies.
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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const LEGACY = "A team member submitted a leave request for review.";

const { data, error } = await db.from("notifications").select("id, user_id, type, body, entity_type, entity_id, action_url");
if (error) { console.error("read failed:", error.message); process.exit(1); }
if (!data?.length) { console.error("notifications came back empty"); process.exit(1); }

let problems = 0;
console.log(`notifications: ${data.length}\n`);

for (const t of ["leave.request", "leave.decision", "ticket.created", "ticket.assigned"]) {
  const rows = data.filter((n) => n.type === t);
  const uniq = new Set(rows.map((n) => n.body));
  const ok = uniq.size === rows.length;
  if (!ok) problems += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${t.padEnd(16)} ${String(rows.length).padStart(3)} rows, ${uniq.size} distinct bodies`);
}

const legacy = data.filter((n) => n.body === LEGACY);
console.log(`\n${legacy.length === 0 ? "OK  " : "FAIL"} legacy generic bodies remaining: ${legacy.length}`);
if (legacy.length) problems += 1;

// Every seeded row must point at a row that exists, or it is a dead link again.
const leaveIds = new Set((await db.from("leave_requests").select("id")).data.map((r) => r.id));
const ticketIds = new Set((await db.from("tickets").select("id")).data.map((r) => r.id));
let dead = 0;
for (const n of data) {
  if (!n.entity_id) { dead += 1; continue; }
  const pool = n.entity_type === "ticket" ? ticketIds : leaveIds;
  if (!pool.has(n.entity_id)) dead += 1;
}
console.log(`${dead === 0 ? "OK  " : "FAIL"} dead-linked rows: ${dead}`);
if (dead) problems += 1;

// Distinctness across the leave.request inbox a team lead actually sees.
const perUser = new Map();
for (const n of data.filter((x) => x.type === "leave.request")) {
  if (!perUser.has(n.user_id)) perUser.set(n.user_id, []);
  perUser.get(n.user_id).push(n.body);
}
for (const [uid, bodies] of perUser) {
  const u = new Set(bodies);
  console.log(`${u.size === bodies.length ? "OK  " : "FAIL"} team-lead inbox ${uid.slice(0, 8)}: ${bodies.length} rows, ${u.size} distinct`);
  if (u.size !== bodies.length) problems += 1;
}

console.log(problems === 0 ? "\nall notification checks passed" : `\n${problems} PROBLEM(S)`);
process.exitCode = problems === 0 ? 0 : 1;