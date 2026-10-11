// What does the hire path actually have to work with right now?
//
// `qa-exercise-hire-workflow.mjs` aborted with `Error: no published job` because
// `job_postings` has no row with `status = 'published'`, so the fixture
// `job_applications` row it seeds has nothing to attach to.
//
// Before changing anything, print the three tables the whole leg depends on:
// `job_postings` (what statuses exist), `applicants` (did the aborted run leak a
// fixture row?), and `job_applications`.
//
// Read-only: no writes.
//
// Usage: node scripts/audit/qa-probe-hire-fixture-state.mjs

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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function rows(table, select, order = "created_at") {
  const { data, error } = await db.from(table).select(select).order(order, { ascending: false });
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

const postings = await rows("job_posts", "id, title, status");
console.log(`job_postings: ${postings.length}`);
for (const p of postings) console.log(`   status=${(p.status ?? "(null)").padEnd(12)} ${p.title}  ${p.id}`);

const applicants = await rows("applicants", "id, email, profile_id, source");
console.log(`\napplicants: ${applicants.length}`);
for (const a of applicants) {
  console.log(`   ${a.email}  profile=${a.profile_id ?? "NONE"}  source=${a.source ?? "-"}  ${a.id}`);
}

const apps = await rows("job_applications", "id, applicant_id, job_post_id, stage");
console.log(`\njob_applications: ${apps.length}`);
for (const a of apps) {
  console.log(`   stage=${(a.stage ?? "(null)").padEnd(10)} applicant=${a.applicant_id}  job=${a.job_post_id}  ${a.id}`);
}

const leaked = applicants.filter((a) => a.source === "qa_hire_fixture");
console.log(`\nLEAKED FIXTURE APPLICANTS (source=qa_hire_fixture): ${leaked.length}`);
for (const l of leaked) {
  const own = apps.filter((a) => a.applicant_id === l.id);
  console.log(`   ${l.email} ${l.id}  applications=${own.length}`);
}