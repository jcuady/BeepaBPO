// Audit: list every page in the app, the action it calls, the required permission,
// and whether the page has filter, pager, empty state.
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import { resolve } from "node:path";

async function* walk(dir) {
  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name === "page.tsx") yield path;
  }
}

const FILES = [];
for await (const p of walk("app/app")) FILES.push(p);

function pageRoute(file) {
  // app/app/foo/bar/page.tsx → /app/foo/bar
  return "/" + file
    .replace(/^app[/\\]/, "")
    .replace(/[/\\]page\.tsx$/, "")
    .replace(/[/\\]\([a-z_]+\)[/\\]/g, "/") // groups
    .replace(/\[/g, ":")
    .replace(/\]/g, "");
}

function checks(src) {
  return {
    filter: /FilterBar[\s\S]*?defaultValue=/.test(src) || /\<FilterBar[^>]*showSearch={false}/.test(src),
    pager: /ListPager\s/.test(src),
    empty: /EmptyState/.test(src),
    realtime: /RealtimeRefresh/.test(src),
    pagination: /\.range\(/.test(src),
    hasForm: /<form /.test(src) || /<form\n/.test(src),
    hasActions: /requirePermission\(/.test(src),
  };
}

let total = 0, withFilter = 0, withPager = 0, withEmpty = 0, withRealtime = 0;
const rows = [];
for (const f of FILES.sort()) {
  const src = readFileSync(f, "utf8");
  const c = checks(src);
  total++;
  if (c.filter) withFilter++;
  if (c.pager) withPager++;
  if (c.empty) withEmpty++;
  if (c.realtime) withRealtime++;
  rows.push({ route: pageRoute(f), file: f, ...c });
}

console.log(`App pages: ${total}`);
console.log(`  FilterBar:    ${withFilter}/${total} (${Math.round((withFilter/total)*100)}%)`);
console.log(`  ListPager:    ${withPager}/${total} (${Math.round((withPager/total)*100)}%)`);
console.log(`  EmptyState:   ${withEmpty}/${total} (${Math.round((withEmpty/total)*100)}%)`);
console.log(`  Realtime:     ${withRealtime}/${total} (${Math.round((withRealtime/total)*100)}%)`);

console.log("\n--- Pages missing ListPager ---");
for (const r of rows) {
  if (!r.pager && r.filter) console.log(`  ${r.route}`);
}
console.log("\n--- Pages with Realtime ---");
for (const r of rows) {
  if (r.realtime) console.log(`  ${r.route}`);
}