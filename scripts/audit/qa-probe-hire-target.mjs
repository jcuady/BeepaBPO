// Does the Demo Applicant still have what the hire path needs?
//
// `qa-exercise-hire-workflow.mjs` resolves its target by email and then refuses to run
// unless that applicant has a `profile_id`. It recently aborted with:
//
//   Demo Applicant not found, or has no profile_id - cannot exercise the hire path
//
// That message conflates two very different situations -- "the seeded demo row is gone"
// and "the seeded row is there but half-populated" -- and they have opposite fixes. This
// prints which one it is, plus the other candidates, so the hire leg can be unblocked
// without guessing.
//
// Read-only: no writes.
//
// Usage: node scripts/audit/qa-probe-hire-target.mjs

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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// `applicants` has NO `stage` column -- stage lives on `job_applications`. Selecting a
// column that does not exist fails the whole query, which is how this script first died
// and looked like a data problem. Read the shape from types/database.ts rather than
// guessing a stage column onto the wrong table.
const { data: applications, error: appErr } = await db
  .from("job_applications")
  .select("applicant_id, stage")
  .order("created_at", { ascending: false });
if (appErr) throw new Error(`job_applications: ${appErr.message}`);

const stageByApplicant = new Map();
for (const row of applications ?? []) {
  if (!stageByApplicant.has(row.applicant_id)) stageByApplicant.set(row.applicant_id, row.stage);
}

const { data: applicants, error } = await db
  .from("applicants")
  .select("id, profile_id, first_name, last_name, email, source")
  .order("created_at", { ascending: false });
if (error) throw new Error(`applicants: ${error.message}`);

console.log(`applicants: ${applicants.length}\n`);
for (const a of applicants) {
  console.log(
    `  ${String(stageByApplicant.get(a.id) ?? "no application").padEnd(18)} profile=${a.profile_id ? "yes" : "NO "}  ${a.email}  (${a.first_name} ${a.last_name}, ${a.source})`,
  );
}

const target = applicants.find((a) => a.email === "applicant@demo.beepabpo.com");
console.log(`\nthe hire workflow's target: applicant@demo.beepabpo.com`);
if (!target) {
  console.log("  -> NO SUCH ROW. The seeded demo applicant is missing; this is a SEED gap.");
} else if (!target.profile_id) {
  console.log("  -> the row exists but profile_id is NULL: half-populated seed.");
  const { data: memberships } = await db
    .from("organization_memberships").select("id, user_id, membership_type, status")
    .in("membership_type", ["applicant"]);
  console.log(`     applicant memberships in the DB: ${memberships?.length ?? 0}`);
} else {
  console.log(`  -> OK, profile_id=${target.profile_id}`);
  // `profiles` has NO `email` column. Selecting it fails the whole query, `data` comes back
  // null, and this used to print "MISSING (dangling profile_id)" -- a statement about the
  // projection, not about the database. `profiles` is not the only table where a wrong
  // column name has already cost a full debugging cycle; check the error before believing
  // an absence.
  const { data: p, error: pErr } = await db
    .from("profiles").select("id, display_name").eq("id", target.profile_id).maybeSingle();
  if (pErr) {
    console.log(`     profile row: QUERY FAILED (${pErr.message}) - probe bug, not a data finding`);
  } else {
    console.log(`     profile row: ${p ? `${p.display_name} (${p.id.slice(0, 8)})` : "GENUINELY MISSING (dangling profile_id)"}`);
  }
}

const hirable = applicants.filter(
  (a) => a.profile_id && !["hired", "rejected", "withdrawn"].includes(stageByApplicant.get(a.id) ?? ""),
);
console.log(`\napplicants with a profile_id and a stage the hire action could accept: ${hirable.length}`);

// The demo sign-in for this role is applicant@demo.beepabpo.com. Even with no `applicants`
// row, that account exists with an auth user and an applicant membership, and therefore a
// profile -- which is exactly what a hireable applicant needs. If so, the gap is the
// MISSING applicants row, not a missing person, and the exercise can build its own fixture
// instead of depending on seeded data that never existed.
const { data: users, error: uErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (uErr) throw new Error(`listUsers: ${uErr.message}`);
const demoAuthUser = users.users.find((u) => u.email === "applicant@demo.beepabpo.com");
if (!demoAuthUser) {
  console.log("\ndemo auth user applicant@demo.beepabpo.com: MISSING entirely");
} else {
  const { data: memberships } = await db
    .from("organization_memberships")
    .select("id, user_id, membership_type, status")
    .eq("user_id", demoAuthUser.id);
  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .select("id, display_name")
    .eq("id", demoAuthUser.id)
    .maybeSingle();
  console.log(`\ndemo auth user applicant@demo.beepabpo.com: ${demoAuthUser.id}`);
  console.log(`  memberships: ${(memberships ?? []).map((m) => `${m.membership_type}/${m.status}`).join(", ") || "none"}`);
  // CHECK THE ERROR. An earlier version of this probe selected a non-existent column,
  // so the query failed, `data` came back null, and it printed "profile: MISSING" --
  // which is a statement about my projection, not about the database. The
  // orphan-memberships probe confirms all 13 memberships have a profile.
  if (profileErr) {
    console.log(`  profile: QUERY FAILED (${profileErr.message}) - this is a probe bug, not a data finding`);
  } else {
    console.log(`  profile: ${profile ? `${profile.display_name} (${profile.id.slice(0, 8)})` : "GENUINELY MISSING"}`);
  }
  console.log(
    `\nVERDICT: ${
      profileErr
        ? "INCONCLUSIVE -- fix the probe's projection before drawing any conclusion."
        : profile && memberships?.some((m) => m.membership_type === "applicant")
          ? "the person EXISTS with an applicant membership and a profile; only the applicants/job_applications rows are missing. The exercise can seed them itself and hire without sending an email."
          : "the person is missing something the hire action needs; this is more than a fixture gap."
    }`,
  );
}