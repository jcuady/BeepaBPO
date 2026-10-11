// Clear recruitment QA residue left behind by `qa-exercise-hire-workflow.mjs`.
//
// WHY this exists as a standalone script rather than only a `finally`: the abort that
// started this happened during TARGET RESOLUTION, which ran above the exercise's `try`,
// so no `finally` could fire. That leaked an `applicants` row, and because the exercise
// finds its target by email it then silently REUSED the leaked row on every later run, so
// the leak would have persisted for the whole session. Running cleanup as its own check is
// what makes a future leak visible instead of self-perpetuating.
//
// Three residue classes, each handled independently -- an empty one must never short-
// circuit the others, which is a bug this script had once already (it exited "nothing to
// clean" when only the applicant table happened to be empty):
//
//   1. `applicants` rows with `source = 'qa_hire_fixture'`
//   2. `job_applications` owned by those applicants
//   3. `audit_logs` rows that point at an application which no longer exists
//
// SCOPE. (1) is selected by a value this harness invents; the six seeded demo applicants
// use `referral`, `job_post`, `linkedin` and `careers_page`, so no real row carries the
// marker. (3) is selected by ABSENCE -- the entity_id resolves to no live
// `job_applications` row -- so by construction it cannot touch audit history for a real
// application. Rows are printed before deletion, and counts are verified after.
//
// DELETING AUDIT ROWS is normally the wrong instinct. It is right here only because these
// are dangling references to fixtures this harness created and then deleted: an audit trail
// whose subject no longer exists records nothing verifiable. Rows written by real product
// use are never in scope -- `applicant.stage_change` rows from the early sessions are left
// untouched and reported separately.
//
// Usage: node scripts/audit/qa-cleanup-hire-fixture.mjs [--dry-run]

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

const DRY_RUN = process.argv.includes("--dry-run");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

// Baseline first, so "nothing was touched" is a measurement rather than an assumption.
const applicantsBefore = await must(db.from("applicants").select("id, email, source"), "applicants");
const appsBefore = await must(db.from("job_applications").select("id, applicant_id"), "job_applications");
const auditBefore = await must(
  db.from("audit_logs").select("id, action, entity_id, created_at").eq("entity_type", "job_application"),
  "audit_logs",
);

const liveAppIds = new Set(appsBefore.map((a) => a.id));
const HARNESS_ACTIONS = ["application.stage_update", "application.hire_convert"];

const fixtureApplicants = applicantsBefore.filter((a) => a.source === "qa_hire_fixture");
const fixtureIds = new Set(fixtureApplicants.map((f) => f.id));
const fixtureApps = appsBefore.filter((a) => fixtureIds.has(a.applicant_id));
const danglingAudit = auditBefore.filter((a) => !liveAppIds.has(a.entity_id) && HARNESS_ACTIONS.includes(a.action));
const legacyAudit = auditBefore.filter((a) => !liveAppIds.has(a.entity_id) && !HARNESS_ACTIONS.includes(a.action));

console.log(`applicants total: ${applicantsBefore.length}   job_applications total: ${appsBefore.length}`);
console.log(`\n[1] fixture applicants (source=qa_hire_fixture): ${fixtureApplicants.length}`);
for (const f of fixtureApplicants) console.log(`      ${f.email}  ${f.id}`);

console.log(`\n[2] applications owned by those applicants: ${fixtureApps.length}`);
for (const a of fixtureApps) console.log(`      ${a.id}  applicant=${a.applicant_id}`);

console.log(`\n[3] dangling audit rows (application.* pointing at a deleted application): ${danglingAudit.length}`);
for (const d of danglingAudit) console.log(`      ${d.action}  entity_id=${d.entity_id}  at ${d.created_at}`);
console.log(`    (legacy rows left alone: ${legacyAudit.length}${legacyAudit.length ? ` — ${[...new Set(legacyAudit.map((l) => l.action))].join(", ")}` : ""})`);

if (fixtureApplicants.length === 0 && fixtureApps.length === 0 && danglingAudit.length === 0) {
  console.log("\nnothing to clean");
  process.exit(0);
}

if (DRY_RUN) {
  console.log("\n--dry-run: nothing deleted");
  process.exit(0);
}

// Child-first: an application references an applicant.
for (const a of fixtureApps) {
  const { error } = await db.from("job_applications").delete().eq("id", a.id);
  console.log(`  deleted application ${a.id}${error ? `  FAILED ${error.message}` : ""}`);
}
for (const f of fixtureApplicants) {
  const { error } = await db.from("applicants").delete().eq("id", f.id);
  console.log(`  deleted applicant ${f.id}${error ? `  FAILED ${error.message}` : ""}`);
}
for (const d of danglingAudit) {
  const { error } = await db.from("audit_logs").delete().eq("id", d.id);
  console.log(`  deleted audit ${d.id} (${d.action})${error ? `  FAILED ${error.message}` : ""}`);
}

// Verify by re-reading, and fail loudly if anything unexpected survived or vanished.
const applicantsAfter = await must(db.from("applicants").select("id, source"), "applicants after");
const appsAfter = await must(db.from("job_applications").select("id"), "applications after");
const auditAfter = await must(
  db.from("audit_logs").select("id, action, entity_id").eq("entity_type", "job_application"),
  "audit after",
);
const liveAfter = new Set(appsAfter.map((a) => a.id));
const danglingAfter = auditAfter.filter((a) => !liveAfter.has(a.entity_id) && HARNESS_ACTIONS.includes(a.action));

const expectedRemoved = fixtureApplicants.length + fixtureApps.length + danglingAudit.length;
const actualRemoved =
  applicantsBefore.length + appsBefore.length + auditBefore.length -
  (applicantsAfter.length + appsAfter.length + auditAfter.length);

console.log(`\napplicants        ${applicantsBefore.length} -> ${applicantsAfter.length}`);
console.log(`job_applications  ${appsBefore.length} -> ${appsAfter.length}`);
console.log(`audit_logs        ${auditBefore.length} -> ${auditAfter.length}`);
console.log(`rows removed: ${actualRemoved} (expected ${expectedRemoved})`);
console.log(`dangling application.* audit rows remaining: ${danglingAfter.length}`);

const ok =
  danglingAfter.length === 0 &&
  actualRemoved === expectedRemoved &&
  applicantsAfter.filter((a) => a.source === "qa_hire_fixture").length === 0 &&
  applicantsAfter.length === applicantsBefore.length - fixtureApplicants.length &&
  appsAfter.length === appsBefore.length - fixtureApps.length;

console.log(ok ? "\nOK  recruitment residue cleared, demo data untouched" : "\nFAIL  state did not settle as expected");
if (!ok) process.exitCode = 1;