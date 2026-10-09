/**
 * Drop premature payroll finalizations back to draft — READ-ONLY unless `--apply`.
 *
 * Gate step 11 fails because 10 records sit `finalized` inside a period that is
 * still `draft`, which makes PHP 500,000 payable before anyone approved the
 * period. The equivalent SQL is:
 *
 *   update public.payroll_records set status = 'draft'
 *    where status in ('finalized','paid')
 *      and payroll_period_id in (select id from public.payroll_periods
 *                                where status not in ('finalized','disbursed','closed'));
 *
 * Why this is a fix and not a workaround: migration `20261007130000_payroll_record_status_coherence.sql`
 * adds a trigger that REJECTS any future finalized/paid record under an
 * unapproved period. Leaving these rows as-is would put the database permanently
 * out of step with its own rule, so the constraint cannot be trusted until they
 * are corrected.
 *
 * Safety:
 *   - Dry-run by default; `--apply` is required to write.
 *   - Only touches records whose period is NOT in an approved terminal state, so
 *     genuinely finalized-and-disbursed payroll is never reverted.
 *   - Deletes nothing. Reversible: the previous status is printed per record.
 *
 * Run: node scripts/fix-premature-finalization.mjs
 *      node scripts/fix-premature-finalization.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function env() {
  const out = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[t.slice(0, i).trim()] = v;
    }
  }
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[k]) out[k] = process.env[k];
  }
  const key = out.SUPABASE_SECRET_KEY ?? out.SUPABASE_SERVICE_ROLE_KEY;
  if (!out.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL not found");
  if (!key) throw new Error("This script needs a privileged key (SUPABASE_SECRET_KEY)");
  return { url: out.NEXT_PUBLIC_SUPABASE_URL, key };
}

const { url, key } = env();
const sb = createClient(url, key, { auth: { persistSession: false } });
const dryRun = !process.argv.includes("--apply");
console.log(`mode: ${dryRun ? "dry-run (no writes)" : "APPLY"}`);

/** Period states that mean the period has been approved for payment. */
const APPROVED = ["finalized", "disbursed", "closed"];

const { data: periods, error: pErr } = await sb
  .from("payroll_periods")
  .select("id, name, start_date, end_date, status");
if (pErr) throw pErr;

const unapproved = (periods ?? []).filter((p) => !APPROVED.includes(p.status));
console.log(`periods: ${(periods ?? []).length} total, ${unapproved.length} not yet approved`);
for (const p of periods ?? []) {
  console.log(`  [${p.status}] ${p.name} ${p.start_date}..${p.end_date}`);
}

if (unapproved.length === 0) {
  console.log("\nnothing to do — every period is approved.");
  process.exit(0);
}

const { data: records, error: rErr } = await sb
  .from("payroll_records")
  .select("id, employee_id, payroll_period_id, status, net_pay")
  .in("payroll_period_id", unapproved.map((p) => p.id))
  .in("status", ["finalized", "paid"]);
if (rErr) throw rErr;

const total = (records ?? []).reduce((sum, r) => sum + Number(r.net_pay ?? 0), 0);
console.log(`\nprematurely finalized: ${(records ?? []).length} record(s), net ${total.toFixed(2)}`);
for (const r of records ?? []) {
  console.log(`  ${r.id}  employee=${r.employee_id}  status=${r.status}  net=${r.net_pay}`);
}

if ((records ?? []).length === 0) {
  console.log("\nnothing to do — no finalized records under an unapproved period.");
  process.exit(0);
}

if (dryRun) {
  console.log("\nre-run with --apply to set these to 'draft'");
  process.exit(0);
}

const ids = records.map((r) => r.id);
const { error: upErr } = await sb
  .from("payroll_records")
  .update({ status: "draft" })
  .in("id", ids);
if (upErr) throw upErr;

const { data: after } = await sb
  .from("payroll_records")
  .select("id, status")
  .in("id", ids);
const stillFinal = (after ?? []).filter((r) => r.status !== "draft");
console.log(`\nupdated ${ids.length} record(s); ${stillFinal.length} not yet draft`);
if (stillFinal.length) {
  for (const r of stillFinal) console.log(`  STILL ${r.status}: ${r.id}`);
  process.exit(2);
}