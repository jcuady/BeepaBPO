// Reads one slug's presence in the live /sitemap.xml, and classifies the outcome.
//
// Split out from `qa-probe-sitemap-pickup.mjs` because the pickup probe and the rebuild
// that follows it cannot live in one process: `next build` must not run while `next
// start` holds the port, and this repo's standing rule is to verify the port actually
// released and that a DIFFERENT pid serves afterwards -- otherwise the "rebuild" is
// invisible and the old build keeps answering.
//
// Usage: node scripts/audit/qa-read-sitemap.mjs <slug> [--keep]
//
//   absent  -> still build-frozen, or the row never enters at all
//   present -> the sitemap tracks published rows live; nothing to fix
//
// With --keep the row is left in the database (useful when you want to re-read
// after another rebuild). Without it the row is deleted, so re-running is safe.

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

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const keep = args.includes("--keep");
if (!slug) {
  console.error("usage: node scripts/audit/qa-read-sitemap.mjs <slug> [--keep]");
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

try {
  const { data: rows, error } = await admin
    .from("blog_posts").select("id, slug, status").eq("slug", slug).limit(1);
  if (error) throw new Error(`read the row: ${error.message}`);
  if (!rows.length) {
    console.error(`no row with slug ${slug} in the database -- the probe row is gone, so this reading means nothing`);
    process.exit(2);
  }
  console.log(`database: ${slug} status=${rows[0].status}`);

  const res = await fetch(`${BASE}/sitemap.xml`);
  if (!res.ok) throw new Error(`/sitemap.xml returned HTTP ${res.status}`);
  const xml = await res.text();
  const present = xml.includes(`/resources/${slug}`);
  const locs = (xml.match(/<loc>/g) ?? []).length;

  console.log(`sitemap:  ${present ? "PRESENT" : "absent"} (${locs} <loc> entries total)`);
  console.log(`VERDICT:  ${present
    ? "the sitemap tracks published rows; a rebuild is NOT required for pickup"
    : "a PUBLISHED row is still missing from the sitemap after a rebuild"}`);

  if (!keep) {
    const { error: delErr } = await admin.from("blog_posts").delete().eq("slug", slug);
    console.log(`cleanup:  ${delErr ? `FAILED ${delErr.message}` : "probe row deleted"}`);
  } else {
    console.log("cleanup:  skipped (--keep)");
  }
} catch (e) {
  console.error(`RUN ERROR: ${e.message}`);
  process.exitCode = 1;
}