// One-off codemod: replace `error: <expr>.message ?? "<copy>"` with
// `error: writeFailed("<copy>")` across lib/, and add the import.
//
// WHY IT IS A SCRIPT AND NOT 68 HAND EDITS
// The transformation is mechanical and the same at every site, and a
// hand-written pass over 68 lines in 18 files is exactly the kind of change
// that silently skips one. The script reports every site it touched and every
// file it added an import to, so the diff can be read rather than trusted.
//
// It only rewrites the `?? <string literal>` shape. An identifier on the right
// (a shared constant) is left alone and reported, because rewriting that would
// need a decision about the constant rather than a substitution.
//
// Run from the repo root:  node scripts/audit/apply-error-copy.mjs --dry-run

import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");

// Three shapes existed, not one:
//   error: error?.message ?? "copy"      the common one, fallback unreachable
//   error: error.message || "copy"      attendance — same leak, `||` instead
//   error: error.message                notifications — NO fallback at all
// The first two are substitutions. The third has no copy to recover, so it is
// left for a human rather than invented by a regex.
const SITE = /error:\s*(\w+(?:\?\.)?\.message)\s*(?:\?\?|\|\|)\s*("(?:[^"\\]|\\.)*")/g;
const SITE_BARE = /error:\s*\w+(?:\?\.)?\.message\s*[,}]/g;
const SITE_IDENT = /error:\s*\w+(?:\?\.)?\.message\s*(?:\?\?|\|\|)\s*([A-Z_][A-Z0-9_]*)/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(join(ROOT, "lib"));
let totalSites = 0;
let filesChanged = 0;
const skipped = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (rel.endsWith("lib/actions/error-copy.ts")) continue;
  // error-messages.ts is hand-written copy per cause, not a fallback pattern.
  if (rel.endsWith("lib/auth/error-messages.ts")) continue;

  const src = readFileSync(file, "utf8");
  const before = src;

  const matches = [...src.matchAll(SITE)];
  if (matches.length) totalSites += matches.length;
  let next = src.replace(SITE, (_m, expr, copy) => `error: writeFailed(${copy})`);

  const leftover = [...next.matchAll(SITE_IDENT)];
  for (const l of leftover) skipped.push(`${rel}: error: ${l[1]} ${l[2]} ${l[3]}`);

  const bare = [...next.matchAll(SITE_BARE)];
  for (const b of bare) skipped.push(`${rel}: BARE error: ${b[0]} — no copy to recover`);

  if (next === before) continue;

  // Add the import once, after the last existing top-level import so the file
  // keeps a single, tidy import block.
  if (!next.includes("@/lib/actions/error-copy")) {
    const importRe = /^import .*?;$/gm;
    const all = [...next.matchAll(importRe)];
    if (all.length) {
      const last = all[all.length - 1];
      const at = last.index + last[0].length;
      next =
        next.slice(0, at) +
        '\nimport { writeFailed } from "@/lib/actions/error-copy";' +
        next.slice(at);
    } else {
      skipped.push(`${rel}: no top-level import to anchor the new one to`);
    }
  }

  filesChanged++;
  console.log(`${rel}: ${matches.length} site(s)`);
  if (!DRY) writeFileSync(file, next);
}

console.log("");
console.log(`${DRY ? "would change" : "changed"} ${filesChanged} file(s), ${totalSites} site(s)`);
if (skipped.length) {
  console.log(`\n${skipped.length} site(s) NOT rewritten — these need a human look:`);
  for (const s of skipped) console.log("  " + s);
}