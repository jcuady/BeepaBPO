import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The release gate's own honesty.
 *
 * `scripts/verify-all.mjs` is the thing a human trusts when deciding whether to
 * ship. It has twice reported success it had not earned — once printing "16/16
 * passed. All checks passed. Ship it." over a live double payment and ₱500,000
 * of unapproved payroll, and once miscounting its own results as "3 step(s)
 * failed" when only 2 had (it derived failures as `total - passed`, so every
 * skip was also counted as a failure; 13 + 3 + 1 = 17 out of 16 steps).
 *
 * There is no database in CI, so the invariants are pinned by inspecting the
 * source. Each assertion states the failure it prevents.
 */

const GATE = readFileSync(
  join(process.cwd(), "scripts", "verify-all.mjs"),
  "utf8",
);

function audit(name: string): string {
  return readFileSync(
    join(process.cwd(), "scripts", "audit", name),
    "utf8",
  );
}

describe("step accounting", () => {
  it("tracks failures explicitly instead of deriving them", () => {
    // The exact defect: `totalSteps - passedSteps` cannot distinguish a skip
    // from a failure, so the two were silently conflated in the summary.
    expect(GATE).not.toMatch(/failedSteps\s*=\s*totalSteps\s*-\s*passedSteps/);
    expect(GATE).toContain("failedStepList");
    // Every catch records the step.
    expect(GATE).toMatch(/catch\s*\(e\)\s*\{[\s\S]{0,200}?failedStepList\.push/);
  });

  it("asserts passed + failed + skipped accounts for every step", () => {
    // A summary whose parts do not sum to the total is a summary nobody should
    // act on, so the gate now refuses to print a verdict it cannot reconcile.
    expect(GATE).toMatch(
      /accounted\s*=\s*passedSteps\s*\+\s*failedSteps\s*\+\s*skippedSteps\.length/,
    );
    expect(GATE).toMatch(/if\s*\(accounted\s*!==\s*totalSteps\)/);
    expect(GATE).toContain("INTERNAL COUNT ERROR");
    // And it must not claim "ship it" after a bookkeeping failure.
    expect(GATE).toMatch(/INTERNAL COUNT ERROR[\s\S]{0,200}?process\.exit\(2\)/);
  });

  it("names the failing steps rather than only counting them", () => {
    expect(GATE).toContain("Failing steps:");
  });
});

describe("the gate cannot pass on a skip or a soft failure", () => {
  it("'Ship it' requires zero failures AND zero skips", () => {
    expect(GATE).toMatch(
      /if\s*\(failedSteps\s*===\s*0\s*&&\s*skippedSteps\.length\s*===\s*0\)/,
    );
    // Not merely "nothing threw".
    expect(GATE).not.toMatch(/if\s*\(!somethingFailed\)/);
  });

  it("a skipped step is never counted as passed", () => {
    // The skip branch must not fall through into `passedSteps++`; that
    // increment belongs to the `else`. Slice to the `else` so the assertion
    // covers the skip path alone rather than both.
    const from = GATE.indexOf("if (out?.skipped)");
    const skipBranch = GATE.slice(from, GATE.indexOf("} else {", from));
    expect(skipBranch, "skip branch not found").not.toBe("");
    expect(skipBranch).toContain("skippedSteps.push");
    expect(skipBranch).not.toContain("passedSteps++");

    // And the increment does exist, in the else — otherwise the gate could
    // never report a pass and the test above would pass for the wrong reason.
    const elseBranch = GATE.slice(GATE.indexOf("} else {", from), GATE.indexOf("} catch (e)"));
    expect(elseBranch).toContain("passedSteps++");
  });

  it("the payroll data audits throw instead of only printing", () => {
    // These are the two steps that must be able to fail the build. An audit
    // that logs a finding and returns normally is a warning, not a gate.
    for (const name of [
      "audit-payroll-period-overlap.mjs",
      "audit-payroll-status-coherence.mjs",
      "audit-unapproved-payslip-exposure.mjs",
    ]) {
      const src = audit(name);
      expect(src, `${name} does not throw`).toMatch(/\bthrow\b/);
      // And it must not print a verdict while exiting 0.
      expect(src, `${name} exits 0 after finding a problem`).not.toMatch(
        /VERDICT[\s\S]{0,400}?process\.exit\(0\)/,
      );
    }
  });

  it("negative control: a soft audit would be detected", () => {
    // A hypothetical audit that logs and returns normally must fail the check
    // above, otherwise that assertion is vacuous. Note the comment avoids the
    // literal token being searched for — an earlier draft of this control said
    // "no raise anywhere" and matched its own regex.
    const soft = [
      'console.log("VERDICT: reconcile before shipping.");',
      "// returns normally",
    ].join("\n");
    expect(/\bthrow\b/.test(soft)).toBe(false);
    expect(/VERDICT[\s\S]{0,400}?process\.exit\(0\)/.test(soft)).toBe(false);
    const real = audit("audit-payroll-status-coherence.mjs");
    expect(/\bthrow\b/.test(real)).toBe(true);
  });
});

describe("the gate runs the checks it claims to run", () => {
  it("includes build, lint, and the full test suite", () => {
    expect(GATE).toContain("next build");
    expect(GATE).toContain("eslint");
    expect(GATE).toContain("vitest");
  });

  it("wires in the per-action RBAC auditor and the page wiring scanner", () => {
    // Both were added after the gate was first written; a step that exists but
    // is not invoked would be invisible.
    expect(GATE).toContain("audit-action-rbac.mjs");
    expect(GATE).toContain("audit-page-wiring.mjs");
    expect(GATE).toContain("generate-page-inventory.mjs");
  });

  it("exits non-zero whenever it does not ship", () => {
    const exits = [...GATE.matchAll(/process\.exit\((\d)\)/g)].map((m) => m[1]);
    // Only the ship path may exit 0; every other terminal path is 1 or 2.
    expect(exits.filter((c) => c === "0").length).toBe(1);
    expect(exits.length).toBeGreaterThanOrEqual(3);
  });
});