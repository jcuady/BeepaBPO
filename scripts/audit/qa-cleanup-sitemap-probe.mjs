// Remove only the rows these sitemap probes created, and prove nothing else was touched.
//
// SAFETY
// Scoped to the literal prefixes `qa-pickup-` / `qa-sitemap-`, which only
// `qa-probe-sitemap-pickup.mjs` and `qa-exercise-sitemap-unpublish.mjs` ever write. This
// exists because a previous cleanup used a broad `slug.like.qa%` filter and deleted the
// pre-existing demo row `qa-from-day-one`, which had to be restored verbatim from the seed.
// A prefix narrow enough to name the probe AND be checked before deleting is the whole
// point, so this script prints the exact rows it is about to remove BEFORE removing them,
// and refuses to run if it would touch anything outside the probe prefixes.
//
// Usage: node scripts/audit/qa-cleanup-sitemap-probe.mjs

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

const PREFIXES = ["qa-pickup-", "qa-sitemap-"];
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: all, error } = await admin.from("blog_posts").select("id, slug, status");
if (error) throw new Error(`read: ${error.message}`);

const doomed = all.filter((r) => PREFIXES.some((p) => r.slug.startsWith(p)));
const survivors = all.filter((r) => !PREFIXES.some((p) => r.slug.startsWith(p)));

console.log(`probe rows to delete (${doomed.length}):`);
for (const r of doomed) console.log(`  ${r.slug}  [${r.status}]`);
console.log(`rows left untouched (${survivors.length}):`);
for (const r of survivors) console.log(`  ${r.slug}  [${r.status}]`);

// Refuse rather than widen. If a probe row ever got renamed to something outside the
// prefixes, this stops instead of silently leaving QA residue in the demo content.
const suspicious = survivors.filter((r) => /^qa[-_]/.test(r.slug) && r.slug !== "qa-from-day-one");
if (suspicious.length) {
  console.error(`\nREFUSING: rows matching a QA-looking slug outside the probe prefixes: ${suspicious.map((r) => r.slug).join(", ")}`);
  process.exit(2);
}

if (!doomed.length) {
  console.log("\nnothing to delete.");
} else {
  const { error: delErr } = await admin.from("blog_posts").delete().in("id", doomed.map((r) => r.id));
  if (delErr) {
    console.error(`\nDELETE FAILED: ${delErr.message}`);
    process.exitCode = 1;
  } else {
    console.log(`\ndeleted ${doomed.length} probe row(s)`);
  }
}

const { data: after } = await admin.from("blog_posts").select("slug").order("slug");
console.log(`blog_posts now holds ${after.length}: ${after.map((r) => r.slug).join(", ")}`);