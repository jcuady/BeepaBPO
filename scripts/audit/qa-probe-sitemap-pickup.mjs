// Does a newly published blog post enter /sitemap.xml at all, and when?
//
// WHY THIS EXISTS
// `qa-exercise-sitemap-unpublish.mjs` proved, with a SOUND harness this time (the
// serving PID changed, so it really measured a fresh build), that a post published
// through the CMS UI immediately before `next build` still did NOT appear in the
// rebuilt sitemap -- while all four real published posts did. That refutes the
// "the sitemap is frozen at build time" theory, because a build-frozen sitemap
// rebuilt while the post was published MUST list it.
//
// So the question becomes narrower and more dangerous: maybe a newly published post
// never enters the sitemap by any route. This probe answers that directly and
// separately for each half of the mechanism:
//
//   1. Insert a PUBLISHED post straight through the service-role key (no CMS UI).
//   2. Read the sitemap WITHOUT rebuilding  -> is it already there?
//   3. Rebuild, read again                   -> did the build pick it up?
//   4. Also read the same row through the ANON client exactly as `app/sitemap.ts`
//      does, at the same moment.
//
// Reading (4) matters because `app/sitemap.ts` uses `createAnonClient()`, not the
// service-role client the QA suite normally uses. If service role sees the row and
// anon does not, the bug is RLS and everything else is a distraction. If BOTH see
// it and the build still omits it, the bug is in how the sitemap is produced.
//
// The outcome map, stated BEFORE running:
//   (a) present before any rebuild      -> the sitemap is NOT build-frozen
//   (b) absent, present after rebuild   -> build-frozen, as originally hypothesised
//   (c) absent even after rebuild       -> new posts never enter the sitemap at all
//
// Usage: node scripts/audit/qa-probe-sitemap-pickup.mjs

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
const MARK = `qapick${Date.now().toString(36)}`;
const SLUG = `qa-pickup-${MARK}`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const notes = [];
const note = (m) => { notes.push(m); console.log(m); };

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

async function sitemapLists(pathname) {
  const res = await fetch(`${BASE}/sitemap.xml`);
  if (!res.ok) return { ok: false, status: res.status };
  const xml = await res.text();
  return { ok: true, present: xml.includes(pathname), locs: (xml.match(/<loc>/g) ?? []).length };
}

let verdict = "UNDETERMINED";
try {
  // --- insert a PUBLISHED post directly, no CMS UI in the way.
  const row = (await must(
    admin.from("blog_posts").insert({
      title: `QA Pickup ${MARK}`,
      slug: SLUG,
      excerpt: `QA pickup ${MARK}`,
      body: `QA pickup body ${MARK}.`,
      author_user_id: null,
      status: "published",
    }).select("id, slug, status, updated_at, published_at").limit(1),
    "insert published post",
  ))[0];
  note(`inserted ${row.id} status=${row.status} updated_at=${row.updated_at} published_at=${row.published_at}`);

  // --- (4) what does the ANON client see, exactly as app/sitemap.ts queries?
  const anonRows = await must(
    anon.from("blog_posts").select("slug, status").eq("status", "published").limit(200),
    "anon published query",
  );
  note(`anon published rows: ${anonRows.length}; contains probe: ${anonRows.some((r) => r.slug === SLUG)}`);
  note(`anon slugs: ${anonRows.map((r) => r.slug).join(", ")}`);

  // --- (2) BEFORE any rebuild.
  const before = await sitemapLists(`/resources/${SLUG}`);
  note(`sitemap BEFORE rebuild: ${before.present ? "PRESENT" : "absent"} (locs=${before.locs})`);
  if (before.present) verdict = "(a) present before any rebuild -- the sitemap is NOT build-frozen";

  // The row has to SURVIVE a rebuild for the caller to read the result, so the probe
  // hands ownership of the cleanup over rather than deleting it here. Without this the
  // row is gone before the build ever runs and the probe measures nothing.
  note(`BUILD_NOW, then run: node scripts/audit/qa-read-sitemap.mjs ${SLUG}`);
  note(`ROW KEPT: ${SLUG} (delete it yourself once you have the answer)`);
} catch (e) {
  console.error(`RUN ERROR: ${e.message}`);
  process.exitCode = 1;
  const { error } = await admin.from("blog_posts").delete().eq("slug", SLUG);
  note(`cleanup after error: ${error ? `FAILED ${error.message}` : "deleted"}`);
}

console.log(`\nVERDICT BEFORE REBUILD: ${verdict}`);
console.log(`If that said absent, rebuild the app and run: node scripts/audit/qa-read-sitemap.mjs ${SLUG}`);