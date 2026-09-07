import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("payroll period create seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/payroll/actions.ts"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );
  const listPage = readFileSync(
    join(process.cwd(), "app/app/payroll/periods/page.tsx"),
    "utf8",
  );
  const form = readFileSync(
    join(process.cwd(), "components/app/payroll/create-period-form.tsx"),
    "utf8",
  );

  it("exports createPayrollPeriod gated by payroll.manage", () => {
    expect(actions).toContain("export async function createPayrollPeriod");
    expect(actions).toContain('payroll.manage');
    expect(actions).toContain('from("payroll_periods")');
    expect(actions).toContain('from("payroll_records")');
    expect(validation).toContain("export const createPayrollPeriodSchema");
  });

  it("list page exposes create form for managers", () => {
    expect(listPage).toContain("CreatePayrollPeriodForm");
    expect(listPage).toContain("payroll.manage");
    expect(form).toContain("createPayrollPeriod");
  });
});
