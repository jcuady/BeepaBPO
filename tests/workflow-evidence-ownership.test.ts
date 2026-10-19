import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every workflow exercise must write its own evidence, and must write it LAST.
 *
 * WHY THE SECOND HALF MATTERS MORE THAN THE FIRST
 * ----------------------------------------------
 * `scripts/audit/lib/evidence.mjs` does not take a verdict. It DERIVES one:
 *
 *   0 -> PASS, 2 -> BLOCKED, anything else -> FAIL
 *
 * and then cross-checks the checks, so exit 0 with a failed assertion is still
 * FAIL. That design is only as good as the exit code it is handed, and the exit
 * code is a property of WHERE the call sits in the file.
 *
 * `qa-exercise-admin-workflow.mjs` already had this defect: the write sat at the
 * top of its `finally`, above the two lines that set `process.exitCode`. So the
 * code was still `undefined` when the verdict was computed, `writeEvidence`
 * coerced that to 0, and the file recorded `PASS` -- for a run whose assertions
 * had just failed, and whose process exited 1. Nothing was red. The evidence was
 * confidently wrong, which is the one state a QA record must never be in.
 *
 * So the ordering is asserted here rather than left to whoever edits the next
 * exercise. The assertion is deliberately dumb: it counts lines. A write that
 * drifts above the exit code fails, and the message says which file and which
 * two lines to look at.
 *
 * WHY COMMENTS ARE STRIPPED FIRST
 * ------------------------------
 * Because these files explain this exact rule in prose. An unstripped scan would
 * find `writeEvidence` and `process.exitCode =` in the header of every file and
 * pass against files that import nothing and write nothing. Comment text
 * describing a call is not a call.
 *
 * The stripper below blanks comment interiors IN PLACE -- it keeps every newline
 * -- so that the line numbers it reports address the same lines the file has on
 * disk. That is the whole reason it is not the identical helper used by
 * `workflow-evidence-integrity.test.ts`, which has no line numbers to keep.
 */

const AUDIT_DIR = join(process.cwd(), "scripts", "audit");

/**
 * Blank comments without moving a single line.
 *
 * Length-preserving on purpose: the ordering assertion below reports line
 * numbers, and a stripper that collapsed a five-line block comment into nothing
 * would renumber every assertion after it.
 */
function stripComments(src: string): string {
  return src
    // Block comments: blank the interior, keep the newlines between them.
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    // Whole-line `//` comments. `[^\S\n]` is horizontal whitespace only; plain
    // `\s*` would happily match across the newline in front of a later comment.
    .replace(/^[^\S\n]*\/\/.*$/gm, (line) => " ".repeat(line.length))
    // Trailing `//` comments, skipping anything whose preceding character is a
    // colon so that a URL in a string is not mistaken for the start of a comment.
    .replace(/(^|[^:])\/\/.*$/gm, (match, lead: string) => lead + " ".repeat(match.length - lead.length));
}

type Script = { name: string; code: string; lines: string[] };

/** Every `qa-exercise-*.mjs` whose CODE calls `writeEvidence`, sorted. */
const converted: Script[] = readdirSync(AUDIT_DIR)
  .filter((f) => /^qa-exercise-.*\.mjs$/.test(f))
  .map((name) => {
    const code = stripComments(readFileSync(join(AUDIT_DIR, name), "utf8"));
    return { name, code, lines: code.split(/\r?\n/) };
  })
  .filter((s) => /writeEvidence/.test(s.code))
  .sort((a, b) => (a.name < b.name ? -1 : 1));

/** The tuple form `it.each` types most predictably. */
const CASES = converted.map((s) => [s.name, s] as const);

/**
 * The whole rule, as a function, so the controls below can run it against
 * synthetic sources instead of trusting that it fires on the real ones.
 */
function ordering(script: Script) {
  let writeLine = 0;
  let exitLine = 0;
  script.lines.forEach((line, i) => {
    // FIRST call site: one write per file is the convention, and the first is
    // the one that decides anything.
    if (writeLine === 0 && /writeEvidence\s*\(/.test(line)) writeLine = i + 1;
    // LAST assignment: an exercise may set the code several times -- a run
    // failure, then a cleanup failure -- and only the final one is the verdict.
    if (/process\.exitCode\s*=/.test(line)) exitLine = i + 1;
  });
  // A script that ends in `process.exit(code)` has no "line after the assignment"
  // to aim at; the convention there is to write immediately BEFORE the call and
  // pass the code it is about to use. The exemption is applied HERE, in the rule,
  // rather than only in the failure message -- otherwise a script that legitimately
  // writes before its exit would be reported as an offender while the assertion
  // below passed it, which is a test that disagrees with its own output.
  const exempt = /process\.exit\s*\(/.test(script.code);
  return { writeLine, exitLine, exempt, ok: exempt || writeLine > exitLine };
}

describe("workflow evidence ownership", () => {
  it("the scan finds every converted exercise, so it is not vacuously empty", () => {
    // A renamed directory, or a glob that stopped matching, would make every
    // assertion below pass while checking nothing. The list is exact on purpose:
    // it is also the cheapest place to notice a new exercise that has not been
    // converted yet.
    expect(converted.map((s) => s.name)).toEqual([
      "qa-exercise-admin-workflow.mjs",
      "qa-exercise-attendance-workflow.mjs",
      "qa-exercise-auth-workflow.mjs",
      "qa-exercise-client-timesheet-workflow.mjs",
      "qa-exercise-cms-workflow.mjs",
      "qa-exercise-crm-workflow.mjs",
      "qa-exercise-documents-workflow.mjs",
      "qa-exercise-hire-workflow.mjs",
      "qa-exercise-internal-links.mjs",
      "qa-exercise-leave-workflow.mjs",
      "qa-exercise-list-filters.mjs",
      "qa-exercise-money-workflow.mjs",
      "qa-exercise-notifications-workflow.mjs",
      "qa-exercise-nte-workflow.mjs",
      "qa-exercise-payroll-workflow.mjs",
      "qa-exercise-profile-workflow.mjs",
      "qa-exercise-public-careers.mjs",
      "qa-exercise-recruitment-workflow.mjs",
      "qa-exercise-signup-workflow.mjs",
      "qa-exercise-sitemap-unpublish.mjs",
      "qa-exercise-ticket-workflow.mjs",
      "qa-exercise-tickets-workflow.mjs",
      "qa-exercise-uncovered-roles.mjs",
    ]);
  });

  it.each(CASES)("%s calls writeEvidence by importing it, not by reimplementing it", (_name, s) => {
    expect(
      /from\s+"\.\/lib\/evidence\.mjs"/.test(s.code),
      `${s.name} names writeEvidence but does not import it from ` +
        `scripts/audit/lib/evidence.mjs. Twenty copies of a verdict decision is how the ` +
        `lowercase/uppercase split happened in the first place: the shared writer derives the ` +
        `verdict from the exit code so no caller can pass one, and a hand-rolled writer can.`,
    ).toBe(true);
  });

  it.each(CASES)("%s writes its evidence after the exit code is decided", (_name, s) => {
    const { writeLine, exitLine, exempt, ok } = ordering(s);
    expect(
      ok,
      `${s.name} calls writeEvidence() on line ${writeLine}, and its LAST ` +
        `process.exitCode = assignment is on line ${exitLine}.` +
        (exempt
          ? " This script calls process.exit(), so the write is expected immediately before " +
            "that call and the ordering rule does not apply."
          : " writeEvidence derives the verdict from that code, so a write above it records 0 " +
            "and reports PASS for a run that failed. Move the writeEvidence call below the " +
            "last process.exitCode assignment."),
    ).toBe(true);
  });

  it("the comment-stripping is load-bearing", () => {
    // Control. These files each carry a header explaining this rule, so an
    // unstripped scan would match text that is not code.
    const sample = [
      '// we now write evidence through writeEvidence from "./lib/evidence.mjs"',
      "const x = 1;",
    ].join("\n");
    expect(sample).toMatch(/lib\/evidence\.mjs/);
    expect(stripComments(sample)).not.toMatch(/lib\/evidence\.mjs/);
    expect(stripComments(sample)).toContain("const x = 1;");
  });

  it("stripping leaves the line numbers the ordering rule depends on intact", () => {
    // The other control, and the reason this stripper is not a copy of the one
    // in workflow-evidence-integrity.test.ts. A blanked block comment that
    // collapsed to nothing would renumber the `process.exitCode` line from 4 to
    // 2, and the assertion above would then compare two unrelated numbers.
    const sample = ["/* one", "two */", "// three", "process.exitCode = 1;", "const y = 2;"].join("\n");
    const lines = stripComments(sample).split("\n");
    expect(lines).toHaveLength(sample.split("\n").length);
    expect(lines[3]).toContain("process.exitCode = 1;");
    expect(lines[3]).not.toContain("three");
  });

  it("the ordering rule rejects a write placed above the exit code", () => {
    // Control on the rule itself. The exact shape `qa-exercise-admin-workflow.mjs`
    // had: the write at the top of the `finally`, the assignment below it, and a
    // file that said PASS for a run that exited 1.
    const bad: Script = {
      name: "synthetic-bad.mjs",
      code: ["writeEvidence({ id: 'x' });", "process.exitCode = 1;"].join("\n"),
      lines: [],
    };
    bad.lines = bad.code.split("\n");
    const result = ordering(bad);
    expect(result.ok).toBe(false);
    expect(result.writeLine).toBe(1);
    expect(result.exitLine).toBe(2);
  });

  it("the ordering rule stands down for a script that ends in process.exit()", () => {
    // Not a loophole: `process.exit` does not unwind the stack, so a `finally`
    // there would never run, and the convention is to write immediately before
    // the call and pass the code it is about to use.
    const sample: Script = {
      name: "synthetic-exit.mjs",
      code: ["writeEvidence({ id: 'x' });", "process.exit(process.exitCode);"].join("\n"),
      lines: [],
    };
    sample.lines = sample.code.split("\n");
    const result = ordering(sample);
    expect(result.exempt).toBe(true);
    // And the exemption is what makes it pass: the write is on line 1 and there
    // is no `process.exitCode =` assignment at all, so a rule without the
    // exemption would be reading this case the same way as the bad one above.
    expect(result.ok).toBe(true);
  });
});

/**
 * A blocked path must carry its REASON into the evidence file, not just its name.
 *
 * Two exercises recorded `blockedPaths` as a bare list of names, so the file said
 * what was blocked and nothing about why. That is the whole distinction a reader
 * needs: "the provider's mail budget" means wait, "the route 500s" means fix it.
 * §2.13 exists because that distinction was lost — a blocked signup leg and a
 * broken signup leg produced evidence that could not tell them apart.
 *
 * Asserted on source because the on-disk files predate the fix, and re-running
 * the exercises to regenerate them costs the one email window being held.
 */
describe("blocked paths keep their reason", () => {
  const auditDir = join(process.cwd(), "scripts", "audit");

  const carriers = readdirSync(auditDir)
    .filter((f) => /^qa-exercise-.*\.mjs$/.test(f))
    .filter((f) => /blockedPaths:/.test(readFileSync(join(auditDir, f), "utf8")))
    .sort();

  it("the scan finds the carriers, so it is not vacuously empty", () => {
    expect(carriers.length).toBeGreaterThan(0);
  });

  it.each(carriers)("%s does not reduce blockedPaths to bare names", (f) => {
    const src = readFileSync(join(auditDir, f), "utf8");
    // Comments stripped: the fix's own explanation names the old expression.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // Asserted POSITIVELY and with its own inputs in the failure text. The first
    // version was `expect(!matches)`, which reports only "expected true, got
    // false" when it fires -- and, worse, cannot be diagnosed when it does not,
    // which is exactly what happened while this rule was being proven.
    expect(
      /blockedPaths:[^,\n]*\.map\(\(?\s*\w+\s*\)?\s*=>\s*\w+\.name\s*\)/.test(code),
      `${f} maps blockedPaths down to a bare name (raw length ${src.length}, stripped ` +
        `${code.length}), so the reason is printed and lost. A reader cannot tell ` +
        `whether to wait for the environment or fix the product.`,
    ).toBe(false);
  });

  it("a blocked record is stored with its reason, not printed and discarded", () => {
    // The other half: `blocked()` had to start KEEPING the reason, or the
    // `blockedPaths` mapping above would have nothing to map.
    //
    // Three idioms are accepted, because the repo does not have one:
    //   qa-exercise-admin-workflow.mjs   push({ name, reason })  <- already correct
    //   qa-exercise-auth-workflow.mjs    push({ what, why })
    //   qa-exercise-client-timesheet...  push({ name, pass: null, reason })
    //
    // `admin-workflow` was the correct model all along and is what the other two
    // were measured against -- its own comment says "recorded, not just printed".
    for (const f of carriers) {
      const code = readFileSync(join(auditDir, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      const stores =
        /pass:\s*null\s*,\s*reason/.test(code) ||
        /push\(\{\s*\w+\s*,\s*(reason|why)\s*\}\)/.test(code);
      expect(
        stores,
        `${f} has a blockedPaths mapping but nothing that puts a reason next to the name.`,
      ).toBe(true);
    }
  });
});