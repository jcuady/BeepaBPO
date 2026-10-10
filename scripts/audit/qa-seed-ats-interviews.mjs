// Restore + make reproducible the ATS interview/assessment demo rows.
//
// WHY THIS EXISTS
// ---------------
// `tests/live-data-smoke.test.ts` asserts `count("interviews") >= 1` and
// `count("assessments") >= 1`. Those rows were only ever created as a side effect of
// `scripts/audit/batch3-workflows.mjs` (lines 214-241) — an ad-hoc audit script. The
// canonical seed `scripts/audit/apply-data-seed.mjs` never creates them. So the demo
// data a release gate depends on was never guaranteed to exist; it just happened to.
//
// They went missing (both tables now 0 while all 6 job_applications survive with
// original ids and original created_at). Cascade cannot explain it: the FKs are
// `on delete cascade` from job_applications, so any application delete would also have
// taken `application_stage_history`, which is intact at 15 rows. No script or product
// code deletes from either table. Whatever removed them, the reproducible defect is
// the same: nothing in the repo guarantees these rows exist.
//
// This script is idempotent — it only creates rows that are missing, never touches or
// deletes an existing one — and it reads the counts back before reporting.
//
// Usage: node scripts/audit/qa-seed-ats-interviews.mjs

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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ORG = "11111111-1111-1111-1111-111111111111";
const DAY = 86400000;

// Pick a real interviewer. `interviewer_user_id` is nullable, but a demo row pointing
// at a profile that exists is worth more than one pointing at null, so verify the id
// against `profiles` rather than trusting the membership row.
async function pickInterviewer() {
  // Roles do not live on the membership row — `membership_roles` joins it to `roles`.
  const { data: members, error } = await db
    .from("organization_memberships")
    .select("user_id, membership_roles(roles(code))")
    .eq("organization_id", ORG)
    .eq("status", "active")
    .limit(50);
  if (error) throw new Error(`memberships: ${error.message}`);
  const ranked = [...(members ?? [])].sort((a, b) => rank(a) - rank(b));
  for (const m of ranked) {
    if (!m.user_id) continue;
    const { data: p, error: pErr } = await db.from("profiles").select("id").eq("id", m.user_id).maybeSingle();
    if (pErr) continue;
    if (p?.id) return m.user_id;
  }
  function rank(m) {
    const codes = (m.membership_roles ?? []).map((mr) => mr?.roles?.code).filter(Boolean);
    if (codes.includes("hr")) return 0;
    if (codes.includes("recruiter")) return 1;
    if (codes.includes("owner")) return 2;
    return 3;
  }
  return null;
}

const interviewerId = await pickInterviewer();

const { data: apps, error: aErr } = await db
  .from("job_applications")
  .select("id, stage, created_at")
  .order("created_at");
if (aErr) throw new Error(aErr.message);
if (!apps?.length) throw new Error("no job_applications — nothing to seed interviews against");

const { data: ivs, error: iErr } = await db.from("interviews").select("id, job_application_id");
if (iErr) throw new Error(iErr.message);
const { data: ass, error: sErr } = await db.from("assessments").select("id, job_application_id");
if (sErr) throw new Error(sErr.message);

const haveIv = new Set((ivs ?? []).map((r) => r.job_application_id));
const haveAs = new Set((ass ?? []).map((r) => r.job_application_id));

const interviewRows = apps
  .filter((a) => !haveIv.has(a.id))
  .map((a, i) => ({
    job_application_id: a.id,
    interviewer_user_id: interviewerId,
    // Offset per application so the pipeline does not read as one identical block.
    scheduled_at: new Date(Date.now() + (2 + i) * DAY).toISOString(),
    duration_minutes: 45,
    location: "Zoom",
    meeting_url: `https://meet.example/beepa-intv-${a.id.slice(0, 6)}`,
    status: "scheduled",
    notes: "Demo applicant — run role-play on customer empathy + escalation.",
  }));

const assessmentRows = apps
  .filter((a) => !haveAs.has(a.id))
  .map((a) => ({
    job_application_id: a.id,
    title: "Written customer response scenario",
    assessment_type: "written",
    score: 85,
    max_score: 100,
    completed_at: new Date(Date.now() - 1 * DAY).toISOString(),
    notes: "Demo: applicant wrote a clear, empathetic refund response.",
  }));

console.log(`applications: ${apps.length}  existing interviews: ${ivs?.length ?? 0}  existing assessments: ${ass?.length ?? 0}`);
console.log(`interviewer: ${interviewerId ? interviewerId.slice(0, 8) : "null (no verified profile found)"}`);
console.log(`to create: ${interviewRows.length} interview(s), ${assessmentRows.length} assessment(s)`);

if (interviewRows.length) {
  const { error } = await db.from("interviews").insert(interviewRows);
  if (error) throw new Error(`interview insert: ${error.message}`);
}
if (assessmentRows.length) {
  const { error } = await db.from("assessments").insert(assessmentRows);
  if (error) throw new Error(`assessment insert: ${error.message}`);
}

// Read back. A count printed from the insert payload proves nothing about what landed.
const ivAfter = (await db.from("interviews").select("id", { count: "exact", head: true })).count ?? 0;
const asAfter = (await db.from("assessments").select("id", { count: "exact", head: true })).count ?? 0;
console.log(`\nread back: interviews=${ivAfter} assessments=${asAfter}`);

const ok = ivAfter > 0 && asAfter > 0 && ivAfter >= apps.length && asAfter >= apps.length;
console.log(ok ? "OK — every application has an interview and an assessment." : "FAILED — counts below one per application");
if (!ok) process.exitCode = 1;