import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ship gate step 10 ("Payroll periods do not overlap") fails because a draft stub
 * period `2026-09-01..2026-09-30` fully contains the finalized fortnight
 * `2026-09-01..2026-09-15`. The org pays semi-monthly, so September is legitimately
 * two runs; the month-wide period is seed data (`engine: stub_v1`, zero statutory
 * deductions, identical `worked_minutes: 4800` across 30 days) that a stub run built
 * a period around.
 *
 * Retiring it deletes rows, so the safety properties are the point of this test. A
 * script that quietly grows a `--force` flag, or that widens the stub check to
 * "mostly stub", would delete real payroll while still passing every functional test
 * in the suite. These assertions pin the guards, not the happy path.
 */
const ROOT = process.cwd();
const scriptPath = join(ROOT, "scripts/reconcile-payroll-period-overlap.mjs");

const reconcile = existsSync(scriptPath) ? readFileSync(scriptPath, "utf8") : "";
const audit = readFileSync(join(ROOT, "scripts/audit/audit-payroll-period-overlap.mjs"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("payroll overlap reconciliation", () => {
  it("exists and is wired to a package alias", () => {
    expect(existsSync(scriptPath), "scripts/reconcile-payroll-period-overlap.mjs is missing").toBe(true);
    expect(pkg.scripts["fix:payroll-overlap"]).toBe("node scripts/reconcile-payroll-period-overlap.mjs");
  });

  it("is dry-run unless --apply is passed", () => {
    expect(reconcile).toContain('const dryRun = !process.argv.includes("--apply")');
    // The write path must sit behind the dry-run exit, not merely be guarded by a flag.
    expect(reconcile.indexOf('const dryRun')).toBeLessThan(reconcile.indexOf("re-run with --apply"));
  });

  it("refuses to retire approved or disbursed payroll", () => {
    expect(reconcile).toContain(
      'const APPROVED = ["finalized", "disbursed", "closed"]',
    );
    // Candidates are filtered to unapproved periods before anything is chosen.
    expect(reconcile).toContain("!APPROVED.includes(p.status)");
    expect(reconcile).toMatch(/APPROVED\.includes\(t\.status\)[\s\S]{0,200}stop\(2\)/);
  });

  it("refuses to delete any record that is not stub_v1", () => {
    // The whole safety argument is "this period holds nothing real". Widen it to
    // anything weaker (a majority, a `.some()`, a missing key) and the script would
    // happily delete a real computed run.
    expect(reconcile).toContain(
      'const notStub = recs.filter((r) => engineOf(r) !== "stub_v1")',
    );
    expect(reconcile).toMatch(/notStub\.length > 0[\s\S]{0,400}stop\(2\)/);
    // And the guard must run BEFORE any delete is issued.
    const guardAt = reconcile.indexOf("notStub.length > 0");
    const deleteAt = reconcile.indexOf('.from("payroll_periods").delete()');
    expect(guardAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(guardAt);
  });

  it("deletes the period only, so postgres applies one atomic cascade", () => {
    // Deleting components/payslips/records by hand would leave a window in which the
    // records are gone but the period still overlaps.
    expect(reconcile).toContain('.from("payroll_periods").delete().in("id", targetIds)');
    for (const table of ["payroll_components", "payslips", "payroll_records"]) {
      expect(
        new RegExp(`\\.from\\("${table}"\\)\\.delete\\(`).test(reconcile),
        `the script deletes ${table} directly, which breaks the single-statement cascade`,
      ).toBe(false);
    }
  });

  it("does not depend on columns that only exist after a pending migration", () => {
    // It must run BEFORE 20260922120000_payroll_frequency_fixed_salary.sql, which is
    // exactly the window where the overlap still needs fixing. Selecting a column from
    // an unapplied migration is a hard 42703 and the repair becomes unrunnable.
    const periodSelect = reconcile.match(
      /\.from\("payroll_periods"\)\s*\.select\(([^)]*)\)/,
    );
    expect(periodSelect, "could not find the payroll_periods select").not.toBeNull();
    expect(periodSelect![1]).not.toContain("pay_frequency");
  });

  it("tolerates a dependent table that does not exist yet", () => {
    // "Table absent" and "table empty" both mean the cascade leg has nothing at risk,
    // so a missing relation must not abort the preflight.
    for (const code of ["42P01", "42703"]) {
      expect(reconcile).toContain(`"${code}"`);
    }
  });

  it("surfaces set-null links instead of orphaning them silently", () => {
    expect(reconcile).toContain("allowOrphanLinks");
    expect(reconcile).toContain('argv.includes("--allow-orphan-links")');
    expect(reconcile).toMatch(/orphans > 0 && !allowOrphanLinks[\s\S]{0,400}stop\(2\)/);
  });

  it("re-verifies after writing and fails loudly if any overlap remains", () => {
    const after = reconcile.slice(reconcile.indexOf(".from(\"payroll_periods\").delete()"));
    expect(after).toContain("stillOverlapping");
    expect(after).toMatch(/stillOverlapping\.length > 0[\s\S]{0,400}stop\(2\)/);
  });

  it("agrees with the audit and the migration on what overlap means", () => {
    // Inclusive-inclusive in all three places, or the script could retire a period the
    // gate still considers a conflict.
    const inclusive = "a.start_date <= b.end_date && b.start_date <= a.end_date";
    expect(reconcile).toContain(inclusive);
    expect(audit).toContain(inclusive);
    const migration = readFileSync(
      join(ROOT, "supabase/migrations/20261007120000_payroll_period_no_overlap.sql"),
      "utf8",
    );
    expect(migration).toContain("daterange(start_date, end_date, '[]')");
  });

  it("points at the migration it unblocks", () => {
    expect(reconcile).toContain("20261007120000_payroll_period_no_overlap.sql");
  });

  it("never calls process.exit(), which crashes on Windows after a Supabase query", () => {
    // Measured on this repo's own client: after one query, `process.exit(2)` exits
    // 0xC0000409 (a libuv teardown assertion, not a refusal), while setting
    // `process.exitCode` exits 2. A guard that "refuses" with a crash code still
    // blocks, but the operator cannot tell a refusal from a broken script.
    const code = reconcile.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(
      code.includes("process.exit("),
      "the script calls process.exit(); on Windows that trips a libuv assertion after a " +
        "Supabase query and masks the intended exit status",
    ).toBe(false);
    expect(code).toContain("process.exitCode = code;");
  });
});