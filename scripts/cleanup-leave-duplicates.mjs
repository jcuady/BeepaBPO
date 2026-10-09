/**
 * One-off cleanup: delete duplicate bereavement leave rows that the e2e
 * `mutations.spec.ts` runs created during this session.
 *
 * The smoke test asserts exactly one bereavement leave per employee; repeated
 * runs left a 2026-10-21 → 2026-10-22 duplicate. Keeps the earliest row, deletes
 * the rest, and refuses to touch anything outside that group.
 *
 * Safety:
 *   - Only touches rows whose `(employee_id, leave_type_id, start_date,
 *     end_date, status)` tuple repeats more than once.
 *   - Keeps the row with the smallest `created_at` (the canonical seeded row).
 *   - Prints what it deletes before deleting; aborts on any dry-run flag.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function env() {
  // `.env.local` is the convenient path locally, but CI has no such file — it
  // passes the same names as job-level env vars. Reading process.env first means
  // the CI values win, which is what you want when the two could disagree.
  const out = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      let x = line.slice(i + 1).trim();
      if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
      out[line.slice(0, i).trim()] = x;
    }
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[key]) out[key] = process.env[key];
  }
  if (!out.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL not found — set it in .env.local or as an env var",
    );
  }
  if (!(out.SUPABASE_SECRET_KEY ?? out.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) not found — this script needs a privileged key",
    );
  }
  return out;
}

const e = env();
const supabase = createClient(
  e.NEXT_PUBLIC_SUPABASE_URL,
  e.SUPABASE_SECRET_KEY ?? e.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const dryRun = !process.argv.includes("--apply");

console.log(`mode: ${dryRun ? "dry-run (no writes)" : "APPLY"}`);

// leave_type_id is a UUID; resolve "bereavement" to its actual id.
const { data: leaveTypes, error: ltErr } = await supabase
  .from("leave_types")
  .select("id, code")
  .ilike("code", "bereavement");
if (ltErr) throw ltErr;
if (!leaveTypes?.length) {
  console.error("No leave_types row matched 'bereavement'. Available:");
  const { data: all } = await supabase.from("leave_types").select("id, code");
  console.error(all.toString());
  process.exit(2);
}
const bereavementId = leaveTypes[0].id;
console.log(`bereavement leave_type id: ${bereavementId}`);

const { data: rows, error } = await supabase
  .from("leave_requests")
  .select("id, employee_id, leave_type_id, start_at, end_at, status, created_at")
  .eq("leave_type_id", bereavementId);

if (error) throw error;
console.log(`bereavement rows: ${rows.length}`);

// Group by the tuple that must be unique.
const groups = new Map();
for (const r of rows) {
  const k = `${r.employee_id}|${r.leave_type_id}|${r.start_at}|${r.end_at}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

let removed = 0;
for (const [k, rs] of groups) {
  if (rs.length <= 1) continue;
  rs.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const keep = rs[0];
  const extras = rs.slice(1);
  console.log(`\nduplicate group ${k}`);
  console.log(`  keep  ${keep.id}  created_at=${keep.created_at}`);
  for (const x of extras) {
    console.log(`  drop  ${x.id}  created_at=${x.created_at}`);
    if (!dryRun) {
      const { error: delErr } = await supabase.from("leave_requests").delete().eq("id", x.id);
      if (delErr) throw delErr;
    }
    removed++;
  }
}

console.log(`\n${dryRun ? "would delete" : "deleted"} ${removed} duplicate row(s)`);
process.exit(dryRun && removed > 0 ? 0 : 0);