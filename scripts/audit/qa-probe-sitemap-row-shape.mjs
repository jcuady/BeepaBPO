// One-off shape comparison: why does the build-time sitemap query return the four seeded
// articles and not a freshly inserted published one?
//
// Written as a file rather than an inline `node -e`: PowerShell mangles quotes in inline
// JS, and a mangled script that still exits 0 is a measurement that quietly proves nothing.

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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data, error } = await admin
  .from("blog_posts")
  .select("slug, status, published_at, created_at, updated_at")
  .order("slug");
if (error) throw new Error(`read: ${error.message}`);

console.log("every blog_posts row, service role:");
for (const r of data) {
  console.log(
    `  ${String(r.status).padEnd(10)} pub_at=${r.published_at ?? "NULL"}  ${r.slug}`,
  );
}

// The exact query app/sitemap.ts runs, over the anon client, twice: with and without
// the status filter. If the unfiltered anon count matches the service-role count, RLS is
// not what hides the new row.
const asSitemap = () =>
  anon.from("blog_posts").select("slug, updated_at, published_at").eq("status", "published").limit(200);
const unfiltered = () => anon.from("blog_posts").select("slug").limit(200);

for (const [label, q] of [["exactly as sitemap.ts", asSitemap], ["anon, unfiltered", unfiltered]]) {
  const { data: rows, error: e } = await q();
  if (e) { console.log(`anon ${label}: ERROR ${e.message}`); continue; }
  console.log(`anon ${label}: ${rows.length} rows -> ${rows.map((r) => r.slug).join(", ")}`);
}