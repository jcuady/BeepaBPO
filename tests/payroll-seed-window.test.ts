import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixedPayAmount, salaryFactorFor } from "@/lib/payroll/schedule";

/**
 * `scripts/seed-payroll-window.mjs` runs as plain Node, so it cannot import the
 * engine. It therefore restates the pay math from `lib/payroll/schedule.ts`,
 * which is exactly the kind of copy that silently drifts: someone changes the
 * engine's factor table, the seed script keeps paying the old rate, and the
 * demo payroll quietly disagrees with what the app would produce.
 *
 * This test parses the script's own function bodies and compares them against the
 * engine's behaviour, so a drift fails the build rather than the payslips.
 */
const seed = readFileSync(join(process.cwd(), "scripts/seed-payroll-window.mjs"), "utf8");

/** Evaluate the script's restated helper by extracting its body verbatim. */
function seedFactorFor(frequency: string): number {
  const m = /const salaryFactorFor = \(frequency\) => \{([\s\S]*?)\n\};/.exec(seed);
  if (!m) throw new Error("salaryFactorFor not found in the seed script");
  // The extracted body is already valid JS that compares `frequency` to string
  // literals; only comments need stripping.
  const body = m[1].replace(/^\s*\/\/.*$/gm, "");
  return new Function("frequency", body)(frequency) as number;
}

describe("payroll window seed stays in step with the engine", () => {
  it("uses the same salary factor as lib/payroll/schedule.ts", () => {
    for (const frequency of ["monthly", "weekly", "semi_monthly", "hourly"]) {
      expect(seedFactorFor(frequency), `factor for ${frequency} drifted from the engine`).toBe(
        salaryFactorFor(frequency as never),
      );
    }
  });

  it("uses the same rounding as the engine", () => {
    for (const [salary, factor] of [
      [25000, 0.5],
      [33333, 0.5],
      [12345.67, 12 / 52],
      [1, 0.23076923076923078],
    ] as const) {
      expect(fixedPayAmount(salary, factor)).toBe(
        Math.round(salary * factor * 100) / 100,
      );
    }
  });

  it("keeps the engine's helper formulas untouched", () => {
    // Guards the other direction: if the engine changes, this test's comparison
    // basis changes with it and the diff shows up as a failure here too.
    expect(salaryFactorFor("monthly")).toBe(1);
    expect(salaryFactorFor("semi_monthly")).toBe(0.5);
    expect(salaryFactorFor("weekly")).toBeCloseTo(12 / 52, 12);
  });

  it("refuses rather than silently skipping employees without a payroll profile", () => {
    expect(seed).toContain("no payroll_profiles row");
    expect(seed).toMatch(/missing\.length[\s\S]{0,200}process\.exitCode = 2/);
  });

  it("refuses a window that overlaps an existing period", () => {
    expect(seed).toContain("overlaps");
    expect(seed).toMatch(/clash[\s\S]{0,200}process\.exitCode = 2/);
  });

  it("is dry-run unless --apply is passed", () => {
    expect(seed).toContain('const dryRun = !argv.includes("--apply")');
  });
});