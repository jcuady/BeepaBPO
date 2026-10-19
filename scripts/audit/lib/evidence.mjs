// The ONE place a workflow exercise's verdict is decided and written.
//
// WHY THIS EXISTS
// ---------------
// Two writers used to produce `docs/evidence/workflow-*.json`, and they did not
// agree on the shape. `qa-run-workflows.mjs` wrote `verdict: "PASS" | "FAIL"`;
// three exercises wrote their own file at the end of the run and used
// `"pass" | "fail"`. The rollup tallies UPPERCASE:
//
//   tally("PASS"), tally("FAIL"), tally("BLOCKED"), tally("SKIPPED"), and FLAKY
//
// so a lowercase verdict matches none of them. It is not counted as a failure
// either -- `rollupFailed` filters on `"FAIL"` -- which means an exercise that
// wrote its own evidence and was then run on its own **silently disappeared from
// the tally while still contributing its assertions to the total**. That is not
// hypothetical: `workflow-uncovered-roles.json` sat at `verdict: "pass"` on disk,
// published at a time when §2.12c's own advice is to re-run an exercise alone.
//
// It was masked in a full suite run only because the orchestrator overwrites
// every file it touches with its own uppercase verdict afterwards. The bug was
// therefore only ever visible exactly when it mattered most.
//
// WHY THE VERDICT IS DERIVED, NOT PASSED
// --------------------------------------
// Callers do not supply a verdict. They supply the checks and the exit code, and
// this module decides. A caller that passed its own string could re-introduce
// the exact bug above, and no test can catch a value that only exists at
// runtime -- so the wrong value is made unrepresentable instead of policed.
//
// Exit-code mapping is the orchestrator's existing rule, preserved exactly:
//   0 -> PASS, 2 -> BLOCKED, anything else -> FAIL
// with one addition, the cross-check the orchestrator already performed: an
// exercise that exits 0 while printing FAIL lines is FAIL, because "it said it
// passed" is not the same claim as "its assertions passed".
//
// BLOCKED deliberately outranks FAIL. An exercise that exits 2 is reporting that
// the environment prevented a path from executing, which is not a product
// result; downgrading it to FAIL would make the suite permanently red for a
// reason no code change can fix.

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

/**
 * The vocabulary the rollup counts. Anything outside it is invisible there --
 * not a failure, not a pass, not even NO_EVIDENCE. Exported so the rollup and
 * its guard test read the SAME list instead of two that can drift.
 */
export const EVIDENCE_VERDICTS = ["PASS", "FAIL", "BLOCKED", "SKIPPED", "FLAKY"];

/** Exit code -> verdict, before the printed-failure cross-check. */
export function verdictForExitCode(exitCode) {
  const code = Number.isFinite(exitCode) ? exitCode : 0;
  if (code === 0) return "PASS";
  if (code === 2) return "BLOCKED";
  return "FAIL";
}

/**
 * Decide a verdict from the facts an exercise actually has.
 *
 * `checks` are `{ name, pass, detail? }` -- the same shape the orchestrator
 * parses back out of stdout, so a caller can pass either its in-memory results
 * or the parsed ones and get the same answer.
 */
/**
 * @param {{ checks?: Check[], exitCode?: number }} opts
 */
export function deriveVerdict({ checks = [], exitCode = 0 }) {
  const fromExit = verdictForExitCode(exitCode);
  if (fromExit === "PASS" && checks.some((c) => !c.pass)) return "FAIL";
  return fromExit;
}

/**
 * Write one exercise's evidence file.
 *
 * Safe to call from the end of an exercise, and deliberately NOT wrapped in a
 * `finally`: `qa-exercise-uncovered-roles.mjs` ends with
 * `process.exit(process.exitCode)`, and `process.exit` does not unwind the stack,
 * so a `finally` there would never run. Write inline, before the exit.
 *
 * `extra` carries exercise-specific fields (a timezone, per-account sign-in
 * destinations) under a nested key rather than being spread at the top level,
 * so a bespoke field cannot collide with the shared schema.
 *
 * Throws on a check that is not `{ name, pass }`. A malformed assertion would
 * otherwise serialise into the evidence file and be counted as a pass by a
 * reader that trusts `pass`, which is the same class of defect as a missing
 * assertion: silently unfalsifiable.
 */
/**
 * @typedef {{ name: string, pass: boolean, detail?: string }} Check
 */

/**
 * @param {{
 *   id: string,
 *   script?: string,
 *   claim: string,
 *   base: string,
 *   checks?: Check[],
 *   notes?: string[],
 *   other?: string[],
 *   exitCode?: number,
 *   extra?: Record<string, unknown>,
 * }} opts
 */
export function writeEvidence({
  id,
  // `= undefined` rather than a bare property: it is what makes this optional in
  // the inferred parameter type, since every call site derives the path from
  // `id` anyway and passing it twice invites the two to drift apart.
  script = undefined,
  claim,
  base,
  checks = [],
  notes = [],
  other = [],
  exitCode = 0,
  extra = {},
}) {
  const id_ = String(id ?? "").trim();
  if (!id_) throw new Error("writeEvidence: id is required");

  for (const [i, c] of checks.entries()) {
    if (!c || typeof c.name !== "string" || typeof c.pass !== "boolean") {
      throw new Error(
        `writeEvidence(${id_}): check #${i + 1} is not { name: string, pass: boolean } -- ` +
          `got ${JSON.stringify(c)}. A check that cannot be evaluated must not reach the evidence file.`,
      );
    }
  }

  const verdict = deriveVerdict({ checks, exitCode });
  const failed = checks.filter((c) => !c.pass);

  const doc = {
    id: id_,
    script: script ?? `scripts/audit/qa-exercise-${id_}.mjs`,
    claim,
    base,
    when: new Date().toISOString(),
    exitCode: Number.isFinite(exitCode) ? exitCode : 0,
    verdict,
    assertions: checks.length,
    // Every assertion, not only the failures. A report that stores only what
    // went wrong cannot answer "was this actually exercised", which is the first
    // question a reader asks.
    checks,
    failedAssertions: failed,
    notes,
    other,
    // Provenance. `writer` says who decided the verdict above; `confirmedBy`
    // is filled in by the orchestrator when it downgrades one to FLAKY. A
    // reader must be able to tell a verdict the exercise reached on its own
    // from one the suite overrode after a retry.
    writer: "exercise",
  };
  if (Object.keys(extra).length) doc.extra = extra;

  mkdirSync("docs/evidence", { recursive: true });
  const file = `docs/evidence/workflow-${id_}.json`;
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  return { file, verdict, assertions: checks.length };
}

/**
 * Layer a suite-level judgement onto an exercise's OWN evidence file.
 *
 * WHY A SEPARATE FUNCTION: the orchestrator is the only component that knows an
 * exercise failed under load and then passed on a re-run. That verdict has to
 * win -- FLAKY is deliberately neither PASS nor FAIL, and counting a retry-green
 * exercise as PASS is how a board gets published clean on a run that proved
 * nothing. But overwriting the file wholesale would throw away the exercise's
 * record of what it actually asserted, which is the only reason an exercise
 * writes evidence at all.
 *
 * WHY THE FRESHNESS CHECK IS INSIDE: returns false unless the file on disk was
 * written by THIS run of the exercise. Without it, an exercise that crashed
 * before reaching its write would have last run's file merged with this run's
 * verdict -- a record that would look current, be internally consistent, and
 * describe a run that never finished. The caller must fall back to writing from
 * parsed stdout when this returns false.
 *
 * `runStartedAt` is a Date or an ISO string taken before the exercise was
 * spawned.
 */
export function mergeSuiteVerdict(id, { verdict, confirmation = null, exitCode, runStartedAt, printedAssertions = null, printedFailures = null }) {
  const file = `docs/evidence/workflow-${id}.json`;
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { merged: false, reason: "no readable evidence file on disk" };
  }
  if (doc.writer !== "exercise") {
    return { merged: false, reason: `writer is ${JSON.stringify(doc.writer ?? null)}, not "exercise"` };
  }
  const when = Date.parse(doc.when ?? "");
  const since = runStartedAt instanceof Date ? runStartedAt.getTime() : Date.parse(String(runStartedAt ?? ""));
  if (!Number.isFinite(when) || !Number.isFinite(since) || when < since) {
    return {
      merged: false,
      reason: `evidence is from ${doc.when ?? "(no timestamp)"}, before this run started`,
    };
  }

  // The exercise's own outcome, preserved rather than replaced.
  doc.self = {
    verdict: doc.verdict,
    assertions: doc.assertions,
    failed: (doc.failedAssertions ?? []).length,
  };
  doc.verdict = verdict;
  doc.confirmation = confirmation;
  doc.confirmedBy = "qa-run-workflows";
  doc.exitCode = exitCode ?? doc.exitCode;
  // What the orchestrator parsed out of stdout, which is what it based its own
  // verdict on. Kept so a reader can compare the two counts: a disagreement
  // between what the exercise recorded in memory and what it printed is worth
  // seeing, and it used to be impossible to see because one overwrote the other.
  doc.suite = {
    parsedAssertions: printedAssertions,
    printedFailures,
  };
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  return { merged: true, file };
}
