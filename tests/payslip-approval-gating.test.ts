import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Payslip visibility must depend on the payroll *period* being approved, not
// only on the record carrying a final-looking status.
//
// The two status columns move independently and nothing in the schema ties them
// together. Live data demonstrated the consequence: a period still in `draft`
// held ten finalized records worth 500,000 in net pay, and
// `GET /app/my/payroll/<id>/payslip` returned HTTP 200 with a real PDF.
//
// Requiring both is strictly narrowing. The approval flow finalises the period
// and its records together (docs/WORKFLOWS.md), so an approved run still serves
// payslips normally.
//
// These assertions now check that both surfaces import the shared rule from
// `lib/payroll/status-coherence` rather than each carrying its own copy of the
// status lists. Four surfaces held four near-identical lists, and one of them
// (a seed script) had already drifted into publishing money early.

const route = readFileSync(
  join(process.cwd(), "app/app/my/payroll/[recordId]/payslip/route.ts"),
  "utf8",
);
const page = readFileSync(
  join(process.cwd(), "app/app/my/payroll/page.tsx"),
  "utf8",
);

describe("payslip gating", () => {
  it("routes both surfaces through the shared coherence rule", () => {
    expect(route).toContain("@/lib/payroll/status-coherence");
    expect(route).toContain("isRecordPayable");
    expect(page).toContain("@/lib/payroll/status-coherence");
    // Neither surface keeps a private copy of the payable-status lists.
    expect(route).not.toContain("const PAYABLE_RECORD_STATUSES");
    expect(route).not.toContain("const PAYABLE_PERIOD_STATUSES");
  });

  it("reads the period status on the payslip route", () => {
    expect(route).toMatch(/payroll_periods\([^)]*status/);
    expect(route).toContain("periodStatus");
    // The period check is the load-bearing one, so it must be part of the
    // decision rather than a separate afterthought.
    expect(route).toContain("isRecordPayable(record.status, periodStatus)");
  });

  it("refuses the download when the period is not approved", () => {
    const block = route.slice(route.indexOf("isRecordPayable("));
    expect(block.slice(0, 900)).toContain("403");
    // And the employee is told which condition is blocking them.
    expect(block.slice(0, 900)).toContain("once the period is approved");
  });

  it("filters the employee list by period status as well as record status", () => {
    // An inner join is required for PostgREST to filter on the nested column.
    expect(page).toMatch(/payroll_periods!inner\(/);
    expect(page).toMatch(/\.in\(\s*"payroll_periods\.status"/);
    expect(page).toContain("APPROVED_PERIOD_STATUSES");
    expect(page).toContain("PAYABLE_RECORD_STATUSES");
  });

  it("does not silently drop the self/HR authorization checks", () => {
    expect(route).toContain("resolveEmployeeForUser");
    expect(route).toContain("payroll.self");
    expect(route).toContain("payroll.read");
    // The period gate is an addition, not a replacement: record status is
    // still part of the decision, so a calculated record in an approved period
    // is correctly withheld.
    expect(route).toContain("isRecordStatusPayable");
  });
});