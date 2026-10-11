// Repoint document rows that reference a bucket which does not exist.
//
// `scripts/seed-qa-fixtures.mjs` hardcoded `storage_bucket: "documents"`. That bucket
// was never created and no product code writes to it, so every row it produced pointed
// at an unresolvable path: a populated documents list whose every Download button
// failed. The fixture script itself has been corrected to `employee-documents`; this
// repairs the rows it already wrote.
//
// Dry run by default. Reads the affected rows back afterwards rather than trusting the
// update count.
//
// Usage: node scripts/audit/qa-repoint-document-bucket.mjs [--apply]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const FROM = "documents";
const TO = "employee-documents";

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

// Prove the target bucket is real by writing to it and removing the probe. `list()`
// cannot do this: it returns empty with no error for a bucket that does not exist.
async function bucketAcceptsWrites(name) {
  const probe = `qa-probe-${Date.now()}.txt`;
  const { error } = await db.storage.from(name).upload(probe, Buffer.from("probe"), {
    contentType: "text/plain",
    upsert: true,
  });
  if (!error) await db.storage.from(name).remove([probe]);
  return { ok: !error, reason: error?.message ?? null };
}

const target = await bucketAcceptsWrites(TO);
if (!target.ok) {
  console.error(`Target bucket "${TO}" is not writable: ${target.reason}`);
  console.error("Refusing to repoint rows at a bucket that cannot hold them.");
  process.exit(1);
}
console.log(`target bucket "${TO}" verified writable (probe uploaded and removed)\n`);

const affected = await must(
  db.from("documents").select("id, title, storage_bucket, storage_path").eq("storage_bucket", FROM).limit(500),
  "affected rows",
);

console.log(`${affected.length} row(s) reference the non-existent bucket "${FROM}"`);
for (const r of affected) console.log(`  ${r.title}  (${r.storage_path})`);

if (!APPLY) {
  console.log(`\nDry run. Nothing written. Re-run with --apply to repoint ${affected.length} row(s) to "${TO}".`);
} else {
  const ids = affected.map((r) => r.id);
  const { error, count } = await db
    .from("documents")
    .update({ storage_bucket: TO })
    .in("id", ids)
    .select("id", { count: "exact" });
  if (error) {
    console.error(`update failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`\nrepointed ${count} row(s)`);
}

// Assert by reading back: a count printed from the update payload proves nothing about
// what is actually stored.
const stillWrong = await must(
  db.from("documents").select("id, title, storage_bucket").eq("storage_bucket", FROM).limit(500),
  "verify rows still on the old bucket",
);
const nowRight = await must(
  db.from("documents").select("id").eq("storage_bucket", TO).limit(500),
  "verify rows on the new bucket",
);
console.log(`(re-read) rows still on "${FROM}": ${stillWrong.length}; rows on "${TO}": ${nowRight.length}`);

const ok = stillWrong.length === 0;
console.log(`\n${ok ? "OK - no row references the missing bucket." : "NOT OK - see above."}`);
if (!ok) process.exitCode = 1;