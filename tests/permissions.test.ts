import { describe, expect, it } from "vitest";
import { can, canAll, canAny } from "@/lib/permissions/can";

describe("permissions helpers", () => {
  it("can checks membership", () => {
    expect(can(["leave.self", "payroll.self"], "leave.self")).toBe(true);
    expect(can(["leave.self"], "payroll.manage")).toBe(false);
  });

  it("canAny / canAll", () => {
    const perms = new Set(["attendance.self", "leave.approve"]);
    expect(canAny(perms, ["payroll.manage", "leave.approve"])).toBe(true);
    expect(canAll(perms, ["attendance.self", "leave.approve"])).toBe(true);
    expect(canAll(perms, ["attendance.self", "payroll.manage"])).toBe(false);
  });
});
