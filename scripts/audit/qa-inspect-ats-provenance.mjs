// Why are interviews + assessments empty while 6 applications and 15 stage-history
// rows survive? The cascade chain (applicants -> job_applications -> interviews) means a
// wholesale delete would have taken the history too. So either the pre-existing
// applications were deleted and recreated (new ids, recent created_at), or something
// removed only the child rows.
//
// This prints the provenance: who owns each application, when it was created, and
// whether its history / interview / assessment children are still attached.
//
// Usage: node scripts/audit/qa-inspect-ats-provenance.mjs

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

const { data: apps, error: aErr } = await db
  .from("job_applications")
  .select("id, stage, created_at, applicant_id, job_post_id")
  .order("created_at");
if (aErr) throw new Error(aErr.message);

const { data: hist, error: hErr } = await db
  .from("application_stage_history")
  .select("job_application_id, created_at");
if (hErr) throw new Error(hErr.message);

const { data: ivs, error: iErr } = await db.from("interviews").select("id, job_application_id, scheduled_at");
if (iErr) throw new Error(iErr.message);

const { data: ass, error: sErr } = await db
  .from("assessments")
  .select("id, job_application_id, title, completed_at");
if (sErr) throw new Error(sErr.message);

const { data: applicants, error: pErr } = await db
  .from("applicants")
  .select("id, first_name, last_name, email, profile_id, created_at");
if (pErr) throw new Error(pErr.message);

const { data: posts, error: jErr } = await db.from("job_posts").select("id, title, slug");
if (jErr) throw new Error(jErr.message);

console.log(`applications: ${apps.length}  history: ${hist.length}  interviews: ${ivs.length}  assessments: ${ass.length}  applicants: ${applicants.length}\n`);

console.log("APPLICATION PROVENANCE (oldest first)");
for (const a of apps) {
  const h = hist.filter((r) => r.job_application_id === a.id);
  const i = ivs.filter((r) => r.job_application_id === a.id);
  const s = ass.filter((r) => r.job_application_id === a.id);
  const ap = applicants.find((x) => x.id === a.applicant_id);
  const job = posts.find((x) => x.id === a.job_post_id);
  console.log(
    `  ${a.id.slice(0, 8)}  ${a.created_at.slice(0, 19)}  ${String(a.stage).padEnd(18)}` +
      ` hist=${h.length} iv=${i.length} ass=${s.length}` +
      `  applicant=${ap ? `${ap.first_name} ${ap.last_name} (${(ap.email ?? "").slice(0, 28)})` : "MISSING"}` +
      `  job=${job ? JSON.stringify(job.slug) : "MISSING"}`,
  );
}

console.log("\nAPPLICANTS");
for (const ap of applicants) {
  const mine = apps.filter((a) => a.applicant_id === ap.id);
  console.log(
    `  ${ap.id.slice(0, 8)}  ${String(ap.created_at).slice(0, 19)}  ${ap.first_name} ${ap.last_name}` +
      `  profile=${ap.profile_id ? ap.profile_id.slice(0, 8) : "null"}  applications=${mine.length}`,
  );
}

console.log("\nJOB POSTS");
for (const j of posts) {
  console.log(`  ${j.id.slice(0, 8)}  ${JSON.stringify(j.slug)}  apps=${apps.filter((a) => a.job_post_id === j.id).length}`);
}

const orphanHist = hist.filter((r) => !apps.some((a) => a.id === r.job_application_id));
console.log(`\nhistory rows with no surviving application: ${orphanHist.length}`);
const noHist = apps.filter((a) => !hist.some((r) => r.job_application_id === a.id));
console.log(`applications with no history: ${noHist.length}`);
const stages = {};
for (const a of apps) stages[a.stage] = (stages[a.stage] ?? 0) + 1;
console.log(`stage distribution: ${JSON.stringify(stages)}`);