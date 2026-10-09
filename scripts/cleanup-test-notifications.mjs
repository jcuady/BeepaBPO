#!/usr/bin/env node
// Remove notification rows left behind by test runs.
//
// WHY: `audit-data-population.mjs` found 2 rows in `notifications` created by an
// isolation test — type `test.isolation.iso-test-...`, title "isolation
// iso-test-...", body "test". They are indistinguishable from real notifications
// in the UI and a signed-in user can see them.
//
// SCOPE: only rows whose `type` begins with `test.`. No business data matches
// that prefix, and the script prints exactly what it matched before deleting.
//
// DRY RUN BY DEFAULT.
//
// Usage:
//   node scripts/cleanup-test-notifications.mjs
//   node scripts/cleanup-test-notifications.mjs --apply

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

const APPLY = process.argv.includes("--apply");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: rows, error } = await db
  .from("notifications")
  .select("id, type, title, body, created_at")
  .like("type", "test.%")
  .order("created_at");

if (error) {
  console.error(`could not read notifications: ${error.message}`);
  process.exitCode = 1;
} else if (!rows?.length) {
  console.log("no test notifications found — nothing to clean");
} else {
  console.log(`mode: ${APPLY ? "APPLY (deletes)" : "DRY RUN"}`);
  console.log(`${rows.length} row(s) match type LIKE 'test.%':`);
  for (const r of rows) {
    console.log(`  ${r.created_at}  type=${r.type}`);
    console.log(`     title="${r.title}"  body="${String(r.body).slice(0, 60)}"`);
  }
  if (!APPLY) {
    console.log("\nDRY RUN — re-run with --apply to delete. Nothing has been changed.");
  } else {
    const ids = rows.map((r) => r.id);
    const { error: delErr, count } = await db
      .from("notifications")
      .delete({ count: "exact" })
      .in("id", ids);
    if (delErr) {
      console.error(`delete failed: ${delErr.message}`);
      process.exitCode = 1;
    } else {
      console.log(`\ndeleted ${count ?? ids.length} row(s)`);
      const { count: remaining } = await db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .like("type", "test.%");
      console.log(`test notifications remaining: ${remaining ?? 0}`);
    }
  }
}