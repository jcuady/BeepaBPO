// Every document row in the demo tenant points at a storage object that does not exist.
//
// MEASURED, not assumed: all 8 seeded rows resolve to a path that is absent from its
// bucket. `getDocumentDownloadUrl` signs whatever path the row carries, so every
// Download button in the demo fails -- the employee sees "Unable to create download
// link" for their own employment contract, their handbook, their certificate of
// employment. The documents page looks populated and every row on it is dead.
//
// This is the same shape as the ATS interviews gap: a demo surface that only looks
// seeded, with nothing in the repo responsible for making it work.
//
// WHAT IT DOES
//
// For each `documents` row whose storage object is missing, upload a small placeholder
// at exactly that path, so the signed URL the product already generates resolves. The
// bytes are labelled placeholders -- this makes the demo honest about being a demo,
// rather than inventing realistic-looking contracts that nobody produced.
//
// The row is NOT modified: title, category, visibility and path are all left alone. Only
// the missing object is added.
//
// USAGE
//
//   node scripts/audit/qa-seed-document-blobs.mjs            # dry run, reports only
//   node scripts/audit/qa-seed-document-blobs.mjs --apply    # writes the placeholders
//
// Dry run by default, like every other writer in this repo. The verification step --
// minting a signed URL and fetching it -- runs either way, because "the row exists" and
// "the download works" are different claims.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

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

// A genuinely valid, tiny, single-page PDF. A file that is not a real PDF would make the
// download "succeed" and then fail in whatever the user opens it with, which would be a
// worse demo than an honest one.
function placeholderPdf(title) {
  const safe = String(title).replace(/[()\\]/g, " ").slice(0, 60);
  const text = `BT /F1 18 Tf 72 700 Td (Beepa demo placeholder) Tj 0 -30 Td /F1 12 Tf (${safe}) Tj 0 -24 Td (This file stands in for the real document.) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// Do NOT trust `listBuckets()` or `list()` to decide whether a bucket exists.
// Measured on this project: `listBuckets()` returns an empty list for the
// service-role key, and `list()` on the non-existent `documents` bucket returns
// empty data with NO error. Both look exactly like "the bucket exists and is empty".
// Only an upload is authoritative, so that is what decides it here. Concluding
// "the bucket does not exist" from either call would have wrongly refused to repair
// rows that are perfectly repairable.
const docs = await must(db.from("documents").select("id, title, storage_bucket, storage_path, mime_type").limit(500), "documents");
if (!docs.length) {
  console.log("no document rows; nothing to do.");
  process.exit(0);
}

async function objectExists(bucket, path) {
  const parts = String(path).split("/");
  const { data, error } = await db.storage
    .from(bucket)
    .list(parts.slice(0, -1).join("/") || undefined, { limit: 1000 });
  if (error) return false;
  return Boolean(data?.some((o) => o.name === parts[parts.length - 1]));
}
if (!docs.length) {
  console.log("no document rows; nothing to do.");
  process.exit(0);
}

const missing = [];
// Hoisted: it is reported after the write block, so declaring it inside that block
// made the reporting line itself throw once the writes had already succeeded.
const failedBuckets = new Set();
for (const d of docs) {
  if (!(await objectExists(d.storage_bucket, d.storage_path))) missing.push(d);
}

console.log(`${docs.length} document row(s); ${missing.length} without a storage object`);
for (const m of missing) console.log(`  ${m.storage_bucket}/${m.storage_path}`);

if (!APPLY) {
  console.log(`\nDry run. Nothing written. Re-run with --apply to create ${missing.length} placeholder file(s).`);
} else {
  let written = 0;
  for (const m of missing) {
    const body =
      String(m.storage_path).endsWith(".pdf") || m.mime_type === "application/pdf"
        ? placeholderPdf(m.title)
        : Buffer.from(
            `Beepa demo placeholder for "${m.title}".\nThis file stands in for the real document.\n`,
            "utf8",
          );
    const { error } = await db.storage
      .from(m.storage_bucket)
      .upload(m.storage_path, body, { contentType: m.mime_type ?? "application/pdf", upsert: true });
    if (error) {
      // Only an upload can tell us the bucket is absent. `list()` on a missing
      // bucket returns empty with no error, so it would have hidden this.
      if (/bucket not found/i.test(error.message)) failedBuckets.add(m.storage_bucket);
      console.error(`  FAILED ${m.storage_bucket}/${m.storage_path}: ${error.message}`);
      continue;
    }
    written += 1;
  }
  console.log(`\nwrote ${written} placeholder object(s)`);
}

// Verify by asking the same question the product asks: does the path now serve bytes?
let reachable = 0;
let unreachable = 0;
for (const d of docs) {
  const { data: signed, error } = await db.storage
    .from(d.storage_bucket)
    .createSignedUrl(d.storage_path, 60);
  if (error || !signed?.signedUrl) {
    unreachable += 1;
    continue;
  }
  const res = await fetch(signed.signedUrl);
  if (res.ok && (await res.arrayBuffer()).byteLength > 0) reachable += 1;
  else unreachable += 1;
}
console.log(`\nverification: ${reachable} document(s) now serve bytes, ${unreachable} still do not`);

// Repeat the listing, because "I wrote N" proves nothing about what landed.
const stillMissing = [];
for (const d of docs) {
  if (!(await objectExists(d.storage_bucket, d.storage_path))) stillMissing.push(d.id);
}
console.log(`(re-read) rows whose object is still absent: ${stillMissing.length}`);

if (failedBuckets?.size) {
  console.log(
    `\nBucket(s) that do not exist and so cannot be repaired: ${[...failedBuckets].join(", ")}\n` +
      "A documents row cannot reference a bucket that was never created.",
  );
}

const ok = unreachable === 0 && stillMissing.length === 0 && !(failedBuckets?.size > 0);
console.log(`\n${ok ? "OK - every document row is downloadable." : "NOT OK - see above."}`);
if (!ok) process.exitCode = 1;