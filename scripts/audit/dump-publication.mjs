// Use the management API to inspect pg_publication_tables.
// Fallback: try the supabase-js rpc for a known function.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, idx).trim()] = v;
}
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT = "nwvnawgxkzwiercllgmg";
process.env.SUPABASE_ACCESS_TOKEN = "[redacted]";
process.env.SUPABASE_SECRET_KEY = "[redacted]";

async function tryManagement() {
  // Supabase management API: GET /v1/projects/{ref}/database/query is internal only.
  // But the CLI uses api.supabase.com/v1/projects/{ref}/cli/login-role, which we tried.
  // Last resort: just check the realtime publication by REPL.
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query: "select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;" }),
  });
  return { status: resp.status, body: await resp.text() };
}

const r = await tryManagement();
console.log("Management API response:", r.status);
if (r.status === 200) {
  try {
    const data = JSON.parse(r.body);
    console.log("Tables in supabase_realtime publication:");
    for (const row of data) {
      console.log(`  - ${row.schemaname}.${row.tablename}`);
    }
  } catch (e) {
    console.log("Response body:", r.body);
  }
} else {
  console.log("Response:", r.body.slice(0, 200));
}