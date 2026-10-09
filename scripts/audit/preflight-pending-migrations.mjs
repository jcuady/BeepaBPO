/**
 * Pending-migration preflight — structural only. Executes nothing.
 *
 * Four migrations are written and unapplied, blocked on DB-privileged
 * credentials, so they have never been run. Four files of SQL that have never
 * been parsed is how a routine `db push` turns into a long debugging session.
 *
 * `supabase db push --dry-run` would settle it properly but authenticates
 * against the linked project, needing the credentials that are missing.
 *
 * WHAT THIS CHECKS — dollar-quoted body balance.
 *
 * A plpgsql function body lives between `$$` markers. If one is missing, the
 * terminator is swallowed and the parser reports a syntax error somewhere after
 * the real cause, or the migration file simply does not load. It is the one
 * failure mode that is cheap to detect statically and expensive to debug live.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO — and the first version of this script
 * tried, and was wrong 80 times in one run:
 *
 *   It did not attempt to resolve `public.x` identifiers. SQL keywords
 *   (`on delete cascade` -> "delete"), data types (`public.numeric`), and table
 *   aliases (`from generate_series(..) ea`) are indistinguishable from schema
 *   objects to a regex. That produced 80 confident nonsense findings — exactly
 *   the shape of gate that gets switched off and then believed when it is
 *   wrong. Resolving identifiers needs a real SQL parser, not a pattern.
 *
 *   It does not check grammar, column names, or data. A clean run here is
 *   "nothing structurally broken", not "will apply".
 *
 * Run: node scripts/audit/preflight-pending-migrations.mjs [migration.sql ...]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();

/**
 * `--dir=<path>` scans a different migrations directory. Used by
 * `tests/migration-preflight.test.ts` to drive this script against throwaway
 * fixtures. Without it the test would have to drop a deliberately broken file
 * into the real `supabase/migrations`, which is precisely the directory a
 * migration push reads.
 */
const dirArg = process.argv.slice(2).find((a) => a.startsWith("--dir="));
// `resolve`, not `join`: a test passes an absolute temp path, and joining an
// absolute path onto ROOT produces a directory that does not exist.
const DIR = dirArg ? resolve(dirArg.slice("--dir=".length)) : join(ROOT, "supabase", "migrations");

/**
 * Written but never applied to the linked project.
 *
 * An explicit pending list, not an applied list computed by subtraction: the
 * first version listed these four under `APPLIED` and inverted the whole
 * premise, reporting 30 long-applied migrations as pending.
 */
const PENDING = [
  "20261006140000_realtime_and_profile_sync.sql",
  "20261007120000_payroll_period_no_overlap.sql",
  "20261007130000_payroll_record_status_coherence.sql",
  "20261008120000_hr_recruitment_access.sql",
];

const onDisk = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const args = process.argv.slice(2).filter((a) => !a.startsWith("--dir="));
const pending = args.length ? args : PENDING;

console.log(`migrations on disk: ${onDisk.length}`);
console.log(`pending: ${pending.length}\n`);

const missing = pending.filter((f) => !onDisk.includes(f));
if (missing.length) {
  console.log(`PROBLEM: listed as pending but not on disk: ${missing.join(", ")}`);
  process.exit(1);
}

const problems = [];
let bodies = 0;

for (const file of pending) {
  const raw = readFileSync(join(DIR, file), "utf8");

  // Counted on the RAW text, not a comment-stripped copy: the markers being
  // counted may sit inside comments, which is itself worth knowing.
  const dollars = (raw.match(/\$\$/g) ?? []).length;
  bodies += dollars / 2;

  if (dollars % 2 !== 0) {
    problems.push(
      `${file}: ${dollars} \$\$ marker(s) — odd count. A function body is missing its terminator, ` +
        `which would swallow the rest of the file.`,
    );
  }

  // An empty statement between two terminating semicolons is legal but usually
  // a botched edit; flag only a clearly empty file body.
  if (!raw.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim()) {
    problems.push(`${file}: file is empty apart from comments.`);
  }
}

console.log(`dollar-quoted bodies across pending migrations: ${bodies}`);

if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
  console.log("\nVERDICT: structurally broken. Fix before pushing.");
  process.exit(1);
}

console.log("\nVERDICT: no structural defects found.");
console.log("        This is NOT proof the migrations will apply. To settle that, run");
console.log("        `supabase db push --dry-run --yes`, which needs the db-push PAT");
console.log("        and DB password listed in docs/REMAINING_WORK.md §1.2.");
process.exit(0);