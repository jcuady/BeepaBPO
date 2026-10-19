// Index every distinct behaviour the workflow suite actually asserts.
//
// WHY THIS EXISTS
// ---------------
// "Every button works" is not a claim you can answer with a pass count. A count
// says how many assertions ran; it does not say how many *distinct things* the
// product did. Thirty-three ticket assertions could be the same button pressed
// thirty-three ways, or thirty-three different controls.
//
// So this reads the per-exercise evidence files the runner writes and produces
// the thing a reader actually wants: the deduplicated list of named behaviours,
// grouped by exercise, with the count.
//
// WHY IT IS DERIVED, NOT HAND-WRITTEN
// -----------------------------------
// A checklist whose "verified behaviour" column was typed by the same person
// who wrote the checks is a claim about the checks, not evidence about the
// product. This file is generated from `docs/evidence/workflow-*.json`, so it
// cannot drift from what ran -- delete an exercise's evidence and its row
// disappears here too.
//
// Usage:
//   node scripts/audit/qa-workflow-assertion-index.mjs
//   node scripts/audit/qa-workflow-assertion-index.mjs --verbose
//
// Exit 0 on success, 2 if the evidence directory is missing or empty (a summary
// that cannot see any evidence must not report a calm zero).

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const EVIDENCE_DIR = "docs/evidence";
const verbose = process.argv.includes("--verbose");

if (!existsSync(EVIDENCE_DIR)) {
  console.error(`ABORT: ${EVIDENCE_DIR} does not exist. Run qa-run-workflows.mjs first.`);
  process.exit(2);
}

// Excludes its own output. Without the second name this file indexed ITSELF --
// `workflow-assertion-index.json` matches `workflow-.*\.json`, so every run
// picked up the previous run's index as a 22nd "exercise" with zero assertions,
// and the reported exercise count silently crept upward with every invocation.
const SELF = "workflow-assertion-index.json";
const files = readdirSync(EVIDENCE_DIR)
  .filter((f) => /^workflow-.*\.json$/.test(f) && f !== "workflow-summary.json" && f !== SELF)
  .sort();

if (!files.length) {
  console.error(
    `ABORT: no workflow-*.json evidence in ${EVIDENCE_DIR}.\n` +
      "       An index of nothing is not an index. Run qa-run-workflows.mjs first.",
  );
  process.exit(2);
}

const exercises = [];

for (const f of files) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(`${EVIDENCE_DIR}/${f}`, "utf8"));
  } catch (e) {
    console.error(`ABORT: ${f} is unreadable (${e.message}). A corrupt evidence file is not evidence.`);
    process.exit(2);
  }
  // A missing `checks` array is a MALFORMED evidence file, not an empty one.
  //
  // This read `Array.isArray(doc.checks) ? doc.checks : []`, which looks like a
  // harmless default and was not. Three exercises wrote their own evidence with
  // the assertions under `results` instead of `checks`; after any standalone run
  // of one of them, this index read that exercise as ZERO assertions --
  // silently, no warning -- shrinking the behaviour universe that
  // `qa-control-surface-census.mjs` measures its control-overlap against. An
  // instrument that cannot distinguish "this exercise asserted nothing" from
  // "this file is shaped wrong" will report the second as the first, and both
  // are reported as a smaller number.
  const checks = Array.isArray(doc.checks) ? doc.checks : null;
  if (!checks) {
    console.error(
      `ABORT: ${f} has no \`checks\` array.\n` +
        "       An evidence file that records no assertions is malformed, not empty.\n" +
        "       Every exercise writes through scripts/audit/lib/evidence.mjs, which\n" +
        "       emits `checks`; a file without it predates that or has been edited by\n" +
        "       hand. Reading it as zero assertions would quietly shrink every number\n" +
        "       derived from this index, so nothing is indexed and nothing is reported.",
    );
    process.exit(2);
  }
  exercises.push({
    id: doc.id ?? f.replace(/^workflow-|\.json$/g, ""),
    claim: doc.claim ?? null,
    verdict: doc.verdict ?? "UNKNOWN",
    when: doc.when ?? null,
    assertionCount: checks.length,
    // Deduplicated within the exercise. The raw count is kept above because
    // "18 assertions, 15 distinct" is itself a useful signal: it says the
    // exercise re-asserted the same thing from several angles.
    behaviours: [...new Set(checks.map((c) => c.name))].sort(),
    failed: checks.filter((c) => !c.pass).map((c) => c.name),
  });
}

/**
 * Cross-exercise overlap.
 *
 * Two exercises asserting the same string is usually fine -- it means the same
 * behaviour was reached from two angles, which is worth knowing. But a large
 * amount of overlap means the suite is spending its budget re-confirming one
 * thing, and this is the only place that would ever become visible.
 */
const byName = new Map();
for (const e of exercises) {
  for (const b of e.behaviours) {
    if (!byName.has(b)) byName.set(b, []);
    byName.get(b).push(e.id);
  }
}
const duplicated = [...byName.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([name, ids]) => ({ name, exercises: ids }))
  .sort((a, b) => b.exercises.length - a.exercises.length);

const distinctBehaviours = byName.size;
const totalAssertions = exercises.reduce((n, e) => n + e.assertionCount, 0);
const passing = exercises.filter((e) => e.verdict === "PASS").length;

const out = {
  when: new Date().toISOString(),
  evidenceDir: EVIDENCE_DIR,
  exercisesIndexed: exercises.length,
  exercisesPassing: passing,
  totalAssertions,
  distinctBehaviours,
  behavioursAssertedByMoreThanOneExercise: duplicated.length,
  duplicated,
  exercises: exercises.map((e) => ({
    id: e.id,
    claim: e.claim,
    verdict: e.verdict,
    when: e.when,
    assertionCount: e.assertionCount,
    distinctBehaviours: e.behaviours.length,
    failed: e.failed,
    // ALWAYS stored. `verbose` controls what is printed to the terminal, never
    // what the evidence file contains.
    //
    // These names were omitted unless --verbose was passed, which left
    // workflow-assertion-index.json holding counts with no list -- and the
    // control-surface census, which matches button labels against these names,
    // therefore read an empty haystack and reported a confident, entirely
    // fictional "0% of buttons are covered". An evidence file whose entire
    // purpose is to BE the list must not ship the list only sometimes.
    behaviours: e.behaviours,
  })),
};

mkdirSync("docs/evidence", { recursive: true });
writeFileSync("docs/evidence/workflow-assertion-index.json", JSON.stringify(out, null, 2) + "\n");

console.log(
  `${exercises.length} exercises, ${totalAssertions} assertions, ` +
    `${distinctBehaviours} distinct named behaviours\n`,
);

for (const e of exercises) {
  const line = `  ${e.id.padEnd(16)} ${String(e.assertionCount).padStart(3)} assertions / ${String(
    e.behaviours.length,
  ).padStart(3)} distinct  ${e.verdict}`;
  console.log(verbose || e.failed.length ? line : line);
  if (e.failed.length) for (const f of e.failed) console.log(`      FAILED: ${f}`);
  if (verbose) for (const b of e.behaviours) console.log(`      - ${b}`);
}

if (duplicated.length) {
  console.log(`\nNOTE  ${duplicated.length} behaviour(s) asserted by more than one exercise:`);
  for (const d of duplicated.slice(0, 10)) console.log(`  "${d.name}" <- ${d.exercises.join(", ")}`);
  if (duplicated.length > 10) console.log(`  ... and ${duplicated.length - 10} more`);
}

console.log("\nwrote docs/evidence/workflow-assertion-index.json");