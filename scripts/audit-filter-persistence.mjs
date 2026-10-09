/**
 * Filter-persistence audit.
 *
 * A list page reads its filters from `searchParams` and renders them in a GET
 * <form>. If it also renders a <ListPager>, the pager's `query` prop decides
 * which filters survive a page change — because hrefFor() rebuilds the URL from
 * that object alone. A filter present in the form but absent from `query` is
 * dropped the moment the user clicks Next: the page changes, the filter
 * silently disappears, and the result set widens to a population the user never
 * asked for. No error, no empty state — just a confidently wrong list.
 *
 * This is the exact failure found on /app/admin/users, where `query={{ q }}`
 * omitted the role filter. It is written as a scan rather than a one-off fix
 * because the shape is easy to reintroduce: adding a FilterSelect to a page
 * that already has a ListPager looks complete until you page forward.
 *
 * Run: node scripts/audit-filter-persistence.mjs
 * Exit 0 when clean, 1 when any page drops a filter.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();

/**
 * Optional: scan a different `app` tree. Used by tests to drive this auditor
 * against throwaway fixtures instead of asserting on the live repo alone.
 *
 * The path is validated by shape rather than trusted blindly. A previous audit
 * in this repo read an email address out of argv[2] unconditionally, so a route
 * argument silently became a username and produced an invented auth error.
 * An argument that is not a directory containing page.tsx is rejected loudly.
 */
function resolveAppDir() {
  const arg = process.argv[2];
  if (!arg) return join(ROOT, "app");
  const resolved = resolve(ROOT, arg);
  let stat;
  try {
    stat = statSync(resolved);
  } catch {
    console.error(`filter-persistence: -- not a path: ${resolved}`);
    process.exit(2);
  }
  if (!stat.isDirectory() || walk(resolved).length === 0) {
    console.error(`filter-persistence: not an app dir with page.tsx: ${resolved}`);
    process.exit(2);
  }
  return resolved;
}

const APP = resolveAppDir();

/** Pages that render a ListPager but intentionally read no filters. */
const IGNORED = new Set([
  // Detail pages keyed by record id, not a filter. stringParam(params.id) is
  // the subject of the page, not a narrowing control.
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const violations = [];
const unverified = [];
let scanned = 0;

for (const file of walk(APP)) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (IGNORED.has(rel)) continue;

  const source = stripComments(readFileSync(file, "utf8"));
  if (!source.includes("<ListPager")) continue;

  scanned += 1;

  // Every filter the page reads off the query string. pageParam is handled
  // separately by the pager itself, so it is not a filter.
  const filterParams = new Set();
  for (const m of source.matchAll(/stringParam\(params\.([A-Za-z0-9_]+)\)/g)) {
    filterParams.add(m[1]);
  }

  // Keys carried across a page change, across every ListPager on the page.
  //
  // Two shapes exist. Most pages inline the object — `query={{ q, status }}` —
  // but attendance builds `filterQuery` above the JSX and passes the variable,
  // because it has four filters to carry and inline it was unreadable. A
  // scanner that only understands the inline form reports that page as dropping
  // every filter, which is how this script first "found" fourteen violations
  // and then one. Resolve both, or trust neither.
  const carried = new Set();
  const addKeys = (body) => {
    for (const entry of body.split(",")) {
      const key = entry.split(":")[0].trim();
      if (/^[A-Za-z0-9_]+$/.test(key)) carried.add(key);
    }
  };

  for (const m of source.matchAll(/query=\{\{([^}]*)\}\}/g)) addKeys(m[1]);

  // `query={...}` — anything that is not an inline literal. A bare identifier is
  // resolved against its declaration; anything more elaborate (a call, a
  // spread, a computed key) is reported as unresolvable rather than guessed at.
  //
  // Note the shape of the match. An earlier draft required the expression to be
  // a bare identifier followed immediately by `}`, which silently skipped
  // `query={buildIt(q)}` entirely — no match, no note, and then the page was
  // accused of dropping every filter it read. Capturing the whole braced
  // expression is what makes "I could not read this" expressible at all.
  let unresolved = false;
  for (const m of source.matchAll(/query=\{([^{}]*)\}/g)) {
    const expr = m[1].trim();
    if (!/^[A-Za-z0-9_]+$/.test(expr)) {
      unresolved = true;
      unverified.push(`${rel}: \`query={${expr}}\` is not a resolvable identifier`);
      continue;
    }
    const decl = new RegExp(`(?:const|let|var)\\s+${expr}\\s*(?::[^=]*)?=\\s*\\{([^}]*)\\}`);
    const found = source.match(decl);
    if (found) {
      addKeys(found[1]);
    } else {
      // A query the scanner cannot resolve is a gap in the scanner, not proof
      // of a bug. Say so rather than reporting an accusation it cannot back.
      unresolved = true;
      unverified.push(`${rel}: \`query={${expr}}\` could not be resolved`);
    }
  }

  // If any pager on this page was unreadable, the page as a whole is
  // unverified. Charging it with every filter on the page would be accusing a
  // file on the strength of a parse that did not finish — the exact move that
  // made the first two drafts of this script cry wolf.
  if (unresolved) continue;

  const dropped = [...filterParams].filter((p) => !carried.has(p));
  if (dropped.length) violations.push({ page: rel, dropped });
}

console.log(`filter-persistence: scanned ${scanned} page(s) with a ListPager`);

for (const note of unverified) {
  console.log(`  NOTE  ${note}`);
}

if (violations.length === 0) {
  console.log("PASS  every filter read by a paginated page is carried into its pager");
  process.exit(0);
}

console.log(`\nFAIL  ${violations.length} page(s) drop a filter on page change:`);
for (const v of violations) {
  console.log(`  ${v.page}`);
  console.log(`    reads: ${v.dropped.join(", ")}  (absent from ListPager query={{...}})`);
}
process.exit(1);