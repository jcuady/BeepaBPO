// Move employee-document rows out of paths the storage RLS policy cannot read.
//
// WHY
//
// `storage_employee_docs_select` (20260906000800_storage_buckets.sql:53) does
//
//   public.is_self_employee(((storage.foldername(name))[1])::uuid)
//
// i.e. it casts the FIRST path segment to uuid. The seeded rows were written as
// `demo/<employee_id>/employment-contract.pdf`, so the cast is applied to the literal
// string "demo" and Postgres raises:
//
//   invalid input syntax for type uuid: "demo"
//
// That is not a denial — it is an exception, so the whole statement fails and the user
// sees a database type error instead of "you do not have access to this file". Every
// seeded employee document was in this state and none of them could be downloaded.
//
// This moves each such object to `<employee_id>/<file>` — the layout the policy, and
// `uploadEmployeeDocument`, actually use — and updates the row to match. The row's
// bytes are moved, not re-uploaded, so nothing is rewritten.
//
// It does NOT fix the policy. A hard cast that raises is its own defect: a path that
// does not start with a uuid should deny quietly, not error out for every user. That is
// documented in docs/QA_REPORT.md rather than changed here, because widening an RLS
// predicate is a security decision this pass is not entitled to make.
//
// Usage: node scripts/audit/qa-repair-document-paths.mjs [--apply]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const BUCKET = "employee-documents";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const docs = await must(
  db.from("documents").select("id, title, storage_bucket, storage_path, employee_id").eq("storage_bucket", BUCKET).limit(500),
  "employee documents",
);

const broken = docs.filter((d) => !UUID_RE.test(String(d.storage_path).split("/")[0] ?? ""));
console.log(`${docs.length} row(s) in ${BUCKET}; ${broken.length} with a first path segment that is not a uuid`);
for (const b of broken) console.log(`  ${b.title}\n    ${b.storage_path}  ->  ${b.employee_id ?? "(no employee)"}`);

if (!broken.length) {
  console.log("\nnothing to repair.");
} else if (!APPLY) {
  console.log(`\nDry run. Nothing written. Re-run with --apply to move ${broken.length} object(s).`);
} else {
  let moved = 0;
  for (const b of broken) {
    // The employee the row belongs to is the right folder owner. Where the row has no
    // employee, look for a uuid segment already in the path rather than inventing one.
    const segs = String(b.storage_path).split("/");
    const embeddedUuid = segs.find((s) => UUID_RE.test(s));
    const owner = b.employee_id ?? embeddedUuid ?? null;
    if (!owner) {
      console.error(`  SKIP ${b.title}: no employee id to file it under`);
      continue;
    }
    const newPath = `${owner}/${segs[segs.length - 1]}`;
    if (newPath === b.storage_path) continue;

    const { data: blob, error: dlErr } = await db.storage.from(BUCKET).download(b.storage_path);
    if (dlErr) {
      console.error(`  SKIP ${b.title}: cannot read the existing object (${dlErr.message})`);
      continue;
    }
    const bytes = Buffer.from(await blob.arrayBuffer());

    const { error: upErr } = await db.storage.from(BUCKET).upload(newPath, bytes, {
      contentType: b.title.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
      upsert: true,
    });
    if (upErr) {
      console.error(`  FAILED ${b.title} -> ${newPath}: ${upErr.message}`);
      continue;
    }

    const { error: upErr2 } = await db.from("documents").update({ storage_path: newPath }).eq("id", b.id);
    if (upErr2) {
      // Roll the new copy back rather than leaving two objects and a row pointing at
      // neither.
      await db.storage.from(BUCKET).remove([newPath]);
      console.error(`  FAILED ${b.title}: row update failed (${upErr2.message}); new object removed`);
      continue;
    }

    await db.storage.from(BUCKET).remove([b.storage_path]);
    moved += 1;
    console.log(`  moved ${b.storage_path} -> ${newPath}`);
  }
  console.log(`\nmoved ${moved} object(s)`);
}

// Assert by reading back: the count a move reports proves nothing about what landed.
const after = await must(
  db.from("documents").select("id, title, storage_path").eq("storage_bucket", BUCKET).limit(500),
  "verify",
);
const stillBroken = after.filter((d) => !UUID_RE.test(String(d.storage_path).split("/")[0] ?? ""));
console.log(`(re-read) rows still on a non-uuid path: ${stillBroken.length}`);
for (const s of stillBroken) console.log(`    ${s.title}: ${s.storage_path}`);

const ok = stillBroken.length === 0;
console.log(`\n${ok ? "OK - every employee document path starts with the employee uuid the policy reads." : "NOT OK - see above."}`);
if (!ok) process.exitCode = 1;