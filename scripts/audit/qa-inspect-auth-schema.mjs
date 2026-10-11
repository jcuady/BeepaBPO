// Print the real columns of the tables the auth exercises touch.
//
// Written because `membership_roles` turned out to have no `id` column, and a `.select("id")`
// against it fails the whole query. Guessing a primary key is a slow way to learn a schema;
// this makes the assumption explicit and cheap.

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

for (const table of process.argv.slice(2).length ? process.argv.slice(2) : ["membership_roles"]) {
  const { data, error } = await admin.from(table).select("*").limit(1);
  if (error) {
    console.log(`${table}: ERROR ${error.message}`);
    continue;
  }
  // A projection of one row only shows columns that came back; to see empty columns too,
  // read the generated type, which is the authoritative shape.
  console.log(`${table}: ${data.length ? Object.keys(data[0]).join(", ") : "(no rows; columns inferred below)"}`);
}