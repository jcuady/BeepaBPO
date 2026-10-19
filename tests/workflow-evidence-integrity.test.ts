import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVIDENCE_VERDICTS, deriveVerdict, writeEvidence } from "../scripts/audit/lib/evidence.mjs";

/**
 * A workflow exercise's evidence file must carry a verdict the rollup can count.
 *
 * WHAT WENT WRONG
 * ---------------
 * Two writers produced `docs/evidence/workflow-*.json` and they disagreed on the
 * spelling of the verdict. `qa-run-workflows.mjs` wrote `"PASS"` / `"FAIL"`;
 * three exercises wrote their own file at the end of their run and wrote
 * `"pass"` / `"fail"`.
 *
 * The rollup tallies UPPERCASE:
 *
 *   tally("PASS") ... tally("FAIL"), tally("BLOCKED"), tally("SKIPPED"), FLAKY
 *
 * so a lowercase verdict matches none of them. It is not a failure either --
 * `rollupFailed` filters on `"FAIL"` -- and it is not NO_EVIDENCE, which is
 * decided by the file being *absent*. The exercise therefore **vanished from
 * every bucket while still adding its assertions to `totalAssertions`**, and the
 * published tally answered a smaller question than its own name implied.
 *
 * It was masked in a full suite run, because the orchestrator overwrites every
 * file it touches with its own uppercase verdict afterwards. So the defect was
 * only ever visible exactly when §2.12c tells you to look: re-running one
 * exercise on its own. `workflow-uncovered-roles.json` sat on disk at
 * `verdict: "pass"` from exactly such a run, at 19/19, published minutes after
 * the summary that claimed to account for all 21 exercises.
 *
 * WHY THE FIX IS NOT "REMEMBER TO USE CAPITALS"
 * --------------------------------------------
 * A convention held by twenty files is a convention that will be broken. The
 * verdict is therefore DERIVED by the shared writer from the exit code and the
 * checks, and no caller may pass one -- so the lowercase form is not discouraged,
 * it is unrepresentable. These tests hold that line.
 */

const EVIDENCE_DIR = join(process.cwd(), "docs", "evidence");

/** Not per-exercise evidence: the rollup and the assertion index. */
const NOT_EXERCISE_EVIDENCE = new Set(["workflow-summary.json", "workflow-assertion-index.json"]);

describe("deriveVerdict", () => {
  const passing = [{ name: "a", pass: true }];
  const failing = [{ name: "a", pass: true }, { name: "b", pass: false }];

  it("exit 0 with every check passing is PASS", () => {
    expect(deriveVerdict({ checks: passing, exitCode: 0 })).toBe("PASS");
  });

  it("exit 0 with a FAILED check is FAIL — 'it said it passed' is not 'its assertions passed'", () => {
    // The orchestrator already made this cross-check. It is the exact shape that
    // hides a real failure behind a green exit code.
    expect(deriveVerdict({ checks: failing, exitCode: 0 })).toBe("FAIL");
  });

  it("exit 2 is BLOCKED even when a check failed — an environment outcome is not a product result", () => {
    // Flipping this would make the suite permanently red for something no code
    // change can fix, which is why BLOCKED is checked before FAIL.
    expect(deriveVerdict({ checks: failing, exitCode: 2 })).toBe("BLOCKED");
  });

  it("any other non-zero exit is FAIL", () => {
    expect(deriveVerdict({ checks: passing, exitCode: 1 })).toBe("FAIL");
  });

  it("an absent exit code is PASS, not a crash", () => {
    // `process.exitCode` is `undefined` until something sets it.
    expect(deriveVerdict({ checks: passing })).toBe("PASS");
  });

  it("no combination of exit code and checks produces a verdict outside the rollup's vocabulary", () => {
    // The actual regression: the shape of the input is irrelevant, because the
    // output is not derived from a caller's spelling of it.
    for (const exitCode of [0, 1, 2, 3, undefined]) {
      for (const checks of [[], passing, failing]) {
        expect(EVIDENCE_VERDICTS).toContain(deriveVerdict({ checks, exitCode }));
      }
    }
  });
});

describe("writeEvidence", () => {
  it("refuses a check that is not { name, pass }", () => {
    // Throws before any disk I/O. A check with no boolean `pass` would serialise
    // into the file and be read as a pass by anything trusting the field, which
    // is the same defect as a missing assertion: silently unfalsifiable.
    expect(() =>
      writeEvidence({ id: "unit", claim: "c", base: "b", checks: [{ name: "a" } as never], exitCode: 0 }),
    ).toThrow(/not \{ name: string, pass: boolean \}/);
    expect(existsSync(join(EVIDENCE_DIR, "workflow-unit.json"))).toBe(false);
  });

  it("requires an id, because the filename is derived from it", () => {
    expect(() => writeEvidence({ id: "  ", claim: "c", base: "b", checks: [], exitCode: 0 })).toThrow(
      /id is required/,
    );
  });
});

describe("evidence on disk", () => {
  const files = existsSync(EVIDENCE_DIR)
    ? readdirSync(EVIDENCE_DIR)
        .filter((f) => /^workflow-.*\.json$/.test(f) && !NOT_EXERCISE_EVIDENCE.has(f))
        .sort()
    : [];

  it("there is evidence to check", () => {
    // Without this, a renamed directory makes every assertion below vacuously
    // true — a green suite proving nothing, which is the failure mode this repo
    // keeps meeting in its own instruments.
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s carries a verdict the rollup can count", (file) => {
    const doc = JSON.parse(readFileSync(join(EVIDENCE_DIR, file), "utf8"));
    // The message goes on `expect`, not on `toContain`: vitest's matcher takes a
    // single argument, and a second one is a type error rather than a note.
    expect(
      EVIDENCE_VERDICTS.includes(doc.verdict),
      `${file} has verdict ${JSON.stringify(doc.verdict)}, which the rollup tallies in no ` +
        `bucket. It is not counted as a failure either, so it disappears from the tally ` +
        `while still contributing its assertions. Write evidence through ` +
        `scripts/audit/lib/evidence.mjs, which derives the verdict instead of taking it.`,
    );
  });
});

describe("exercise evidence writers", () => {
  const auditDir = join(process.cwd(), "scripts", "audit");

  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  /**
   * Scripts that own an evidence file, by EITHER route.
   *
   * The first scan for this matched only the hand-rolled `writeFileSync` shape,
   * which was correct while the bug existed and then went empty the moment the
   * three were fixed -- so its own control test went red and reported the
   * opposite of the truth: "no writers found" read as a vacuous suite rather
   * than as "nothing hand-rolls one any more". A guard that can only see a
   * defect while the defect is present is not a guard.
   *
   * So it matches both routes: a script that imports the shared writer, and one
   * that builds an evidence file itself. The assertion below then says every one
   * of them must take the first route.
   */
  const owners = readdirSync(auditDir)
    .filter((f) => /^qa-exercise-.*\.mjs$/.test(f))
    .filter((f) => {
      const raw = readFileSync(join(auditDir, f), "utf8");
      const code = stripComments(raw);
      return (
        /writeEvidence/.test(code) ||
        /writeFileSync\(\s*[`"']docs\/evidence\/workflow-/.test(code) ||
        /writeFileSync\(\s*\n?\s*[`"']docs\/evidence\/workflow-/.test(raw)
      );
    })
    .sort();

  it("the scan finds the known writers, so it is not vacuously empty", () => {
    // Grown from three to twenty-one when the remaining exercises were moved onto
    // the shared writer. The list stays exact and stays sorted: it is the cheapest
    // place a new `qa-exercise-*.mjs` shows up as NOT writing its own evidence.
    expect(owners).toEqual([
      "qa-exercise-admin-workflow.mjs",
      "qa-exercise-attendance-workflow.mjs",
      "qa-exercise-auth-workflow.mjs",
      "qa-exercise-client-timesheet-workflow.mjs",
      "qa-exercise-cms-workflow.mjs",
      "qa-exercise-crm-workflow.mjs",
      "qa-exercise-documents-workflow.mjs",
      "qa-exercise-hire-workflow.mjs",
      "qa-exercise-leave-workflow.mjs",
      "qa-exercise-list-filters.mjs",
      "qa-exercise-money-workflow.mjs",
      "qa-exercise-notifications-workflow.mjs",
      "qa-exercise-nte-workflow.mjs",
      "qa-exercise-payroll-workflow.mjs",
      "qa-exercise-profile-workflow.mjs",
      "qa-exercise-recruitment-workflow.mjs",
      "qa-exercise-signup-workflow.mjs",
      "qa-exercise-sitemap-unpublish.mjs",
      "qa-exercise-ticket-workflow.mjs",
      "qa-exercise-tickets-workflow.mjs",
      "qa-exercise-uncovered-roles.mjs",
    ]);
  });

  it.each(owners)("%s writes evidence through the shared lib, not a hand-rolled writer", (f) => {
    const src = readFileSync(join(auditDir, f), "utf8");
    // Comments stripped: this file's own header, and every writer's, explains the
    // fix and would otherwise satisfy a naive text match.
    const code = stripComments(src);
    expect(
      /from\s+"\.\/lib\/evidence\.mjs"|from\s+"\.\.\/scripts\/audit\/lib\/evidence\.mjs"/.test(code),
      `${f} builds its evidence file by hand. Twenty copies of a verdict decision is how the ` +
        `lowercase/uppercase split happened in the first place. Import writeEvidence from ` +
        `scripts/audit/lib/evidence.mjs instead.`,
    );
    expect(code).not.toMatch(/verdict:\s*failed\.length\s*\?\s*"(pass|fail)"/);
  });

  it("the comment-stripping is load-bearing", () => {
    // Control. Without stripping, this file's own header and every writer's
    // header explain the fix in prose and name `lib/evidence.mjs`, so the
    // assertions above would pass against files that import nothing.
    const sample = [
      '// we now write evidence through writeEvidence from "./lib/evidence.mjs"',
      "const x = 1;",
    ].join("\n");
    expect(sample).toMatch(/lib\/evidence\.mjs/);
    expect(stripComments(sample)).not.toMatch(/lib\/evidence\.mjs/);
    expect(stripComments(sample)).toContain("const x = 1;");
  });
});
