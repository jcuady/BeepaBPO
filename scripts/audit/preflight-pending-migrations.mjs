/**
 * Migration structural preflight — parses nothing, executes nothing.
 *
 * WHY THE "PENDING" CLAIM WAS DELETED
 * ------------------------------------
 * This script used to print "pending: 4" from a HARDCODED list of filenames,
 * and its header asserted as fact that "four migrations are written and
 * unapplied". That was true when written and stopped being true the moment they
 * were pushed — and it never re-checked. `supabase migration list` now shows all
 * 38 migrations present in both the Local and Remote columns, including all four
 * it named, and `supabase db push --dry-run` answers "Remote database is up to
 * date".
 *
 * So the gate was reporting a backend gap that did not exist, in a repo whose
 * whole standard is that a check may not lie. A hardcoded "pending" list is the
 * worst possible source for a number printed without qualification: it goes
 * stale silently and there is nothing to notice.
 *
 * This script no longer knows, guesses, or prints how many migrations are
 * pending. It cannot know — that requires the database. To find out:
 *
 *     npx supabase migration list     # authoritative, per-migration
 *     npx supabase db push --dry-run  # or just this
 *
 * WHAT IT DOES INSTEAD: structurally preflights every migration on disk. That is
 * always correct regardless of what has been applied, it needs no credentials,
 * and it cannot go stale.
 *
 * WHAT IT CHECKS — dollar-quoted body balance.
 *
 * A plpgsql function body lives between `$$` markers. If one is missing, the
 * terminator is swallowed and the parser reports a syntax error somewhere after
 * the real cause, or the migration file simply does not load. It is the one
 * failure mode that is cheap to detect statically and expensive to debug live.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO — and the first version of this script
 * tried, and was wrong 80 times in one run:
 *
 *   It does not attempt to resolve `public.x` identifiers. SQL keywords
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

const onDisk = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const args = process.argv.slice(2).filter((a) => !a.startsWith("--dir="));
// Default to EVERY migration on disk, not a list of "pending" ones.
//
// This used to default to a hardcoded four that had since been applied, so the
// script kept reporting a backend gap that no longer existed and preflighted the
// wrong files. Checking all of them is always true to the repository and cannot
// go stale; pass explicit filenames to scope it to a push you are about to make.
const target = args.length ? args : onDisk;

console.log(`migrations on disk: ${onDisk.length}`);
console.log(`preflighting: ${target.length}${args.length ? " (explicit list)" : " (all on disk)"}\n`);
console.log("NOTE: this script does not know which migrations are pending -- that needs the database.\n");
console.log("      npx supabase migration list      # authoritative, per migration");
console.log("      npx supabase db push --dry-run   # or just this\n");

const missing = target.filter((f) => !onDisk.includes(f));
if (missing.length) {
  console.log(`PROBLEM: listed but not on disk: ${missing.join(", ")}`);
  process.exit(1);
}

const problems = [];
let bodies = 0;

for (const file of target) {
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

console.log(`dollar-quoted bodies across preflighted migrations: ${bodies}`);

if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
  console.log("\nVERDICT: structurally broken. Fix before pushing.");
  process.exit(1);
}

console.log("\nVERDICT: no structural defects found.");
console.log("        This is NOT proof the migrations will apply. To settle that, run");
console.log("        `npx supabase db push --dry-run --yes` -- it authenticates against");
console.log("        the linked project and, as of this writing, answers \"Remote database");
console.log("        is up to date\" for all 38 migrations. A previous version of this");
console.log("        script claimed the dry run needed a PAT it could not obtain, and used");
console.log("        that as the excuse to assert a pending count it had hardcoded.");
process.exit(0);