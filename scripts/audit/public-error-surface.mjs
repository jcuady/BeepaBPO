// Which server actions are reachable WITHOUT a session, and do any of them
// hand a raw provider message back to the caller?
//
// This settles the severity of the "raw error.message" finding. An internal
// action showing PostgREST text to a signed-in employee is untidy. The same
// action reachable by an anonymous visitor is an information disclosure. The two
// are not the same finding, and the QA report must not blur them.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(join(ROOT, "lib")).concat(walk(join(ROOT, "app")));

const PUBLIC = [];
const RAW_RETURNS = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!src.includes('"use server"')) continue;

  const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");

  // An action that never resolves a workspace has no session gate of its own.
  // Unauthenticated is NOT asserted here -- several actions gate by other means
  // (zod only, or deliberately public). This is the list to inspect, not a verdict.
  const gated = src.includes("resolveWorkspace") || src.includes("requireUser");

  if (!gated) {
    const exports = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    PUBLIC.push({ rel, exports });
  }

  const raws = [...src.matchAll(/error:\s*(\w+(?:\?\.)?\.message)/g)].map((m) => m[1]);
  if (raws.length) RAW_RETURNS.push({ rel, raws, gated });
}

console.log(`files with "use server": ${files.filter((f) => readFileSync(f, "utf8").includes('"use server"')).length}`);
console.log(`actions in files with NO session gate: ${PUBLIC.length} file(s)\n`);

for (const p of PUBLIC) {
  console.log(`  ${p.rel}`);
  for (const e of p.exports) console.log(`      ${e}()`);
}

console.log(`\nfiles returning a raw provider message: ${RAW_RETURNS.length}`);
const ungatedRaw = RAW_RETURNS.filter((r) => !r.gated);
console.log(`...of which are in files with NO session gate: ${ungatedRaw.length}\n`);
for (const r of ungatedRaw) {
  console.log(`  ${r.rel}  -> ${[...new Set(r.raws)].join(", ")}`);
}

console.log(`\nraw-message sites inside session-gated files: ${RAW_RETURNS.length - ungatedRaw.length}`);
const byFile = {};
for (const r of RAW_RETURNS.filter((x) => x.gated)) byFile[r.rel] = r.raws.length;
for (const [rel, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(2)}  ${rel}`);
}