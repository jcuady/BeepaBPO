import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  planFunctionalRoleChange,
  planInternalInviteRoles,
  SELF_SERVICE_BASELINE_ROLE_CODE,
} from "@/lib/admin/role-assignment";

/**
 * Changing somebody's role used to delete every role they held.
 *
 * `employee` is not a job title — it is the self-service baseline, and it is
 * what carries `leave.self`, `payroll.self`, `attendance.self`, `tickets.self`,
 * `approvals.act`, `cash_advance.self`, `nte.self` and `performance.self`. The
 * admin UI offers a single-role select and the confirmation even said "They
 * will switch to Finance", so nothing on screen hinted a second role was about
 * to be destroyed. Promoting Demo Marketing to Finance left them holding
 * `[finance]` and nothing else: their own leave, payslips, attendance and
 * tickets vanished, silently.
 *
 * Found by exercising the path for the first time — it had never run, because
 * `docs/QA_REPORT.md` §5 recorded admin role-assign as unexercised.
 */
describe("changing a member's functional role", () => {
  const seeded = ["marketing", "employee"];

  it("keeps the self-service baseline", () => {
    const plan = planFunctionalRoleChange(seeded, "finance");
    expect(plan.preserved).toEqual(["employee"]);
    expect(plan.result).toEqual(["employee", "finance"]);
  });

  it("removes only the previous functional role", () => {
    const plan = planFunctionalRoleChange(seeded, "finance");
    expect(plan.removed).toEqual(["marketing"]);
    expect(plan.removed).not.toContain("employee");
  });

  it("never invents a baseline for a membership that had none", () => {
    const plan = planFunctionalRoleChange(["client_admin"], "finance");
    expect(plan.preserved).toEqual([]);
    expect(plan.result).toEqual(["finance"]);
  });

  it("handles a membership holding only the baseline", () => {
    const plan = planFunctionalRoleChange(["employee"], "hr");
    expect(plan.result).toEqual(["employee", "hr"]);
    expect(plan.removed).toEqual([]);
  });

  it("does not re-insert the role already held", () => {
    // Re-inserting after a delete would trip the unique constraint on
    // (membership_id, role_id) in the old implementation.
    const plan = planFunctionalRoleChange(["marketing", "employee"], "marketing");
    expect(plan.removed).toEqual([]);
    expect(plan.result).toEqual(["employee", "marketing"]);
  });

  it("treats the baseline code as a real role, not a marker", () => {
    expect(SELF_SERVICE_BASELINE_ROLE_CODE).toBe("employee");
    const plan = planFunctionalRoleChange([SELF_SERVICE_BASELINE_ROLE_CODE], "hr");
    expect(plan.result).toContain(SELF_SERVICE_BASELINE_ROLE_CODE);
  });
});

describe("inviting a staff member", () => {
  it("grants self-service access alongside the chosen role", () => {
    // Inviting somebody as HR used to produce `[hr]` alone, so the person just
    // hired could not open their own leave, payslips, attendance or tickets.
    expect(planInternalInviteRoles("hr")).toEqual(["employee", "hr"]);
    expect(planInternalInviteRoles("finance")).toEqual(["employee", "finance"]);
  });

  it("does not duplicate the baseline when it is the chosen role", () => {
    expect(planInternalInviteRoles("employee")).toEqual(["employee"]);
  });
});

describe("negative control", () => {
  it("the old delete-everything behaviour would fail the baseline assertion", () => {
    // Reproduce the original implementation exactly: delete all, insert one.
    const oldResult = ["finance"];
    expect(oldResult).not.toContain("employee");

    // The rule under test keeps it, so the two genuinely disagree.
    const newResult = planFunctionalRoleChange(["marketing", "employee"], "finance").result;
    expect(newResult).toContain("employee");
    expect(newResult).not.toEqual(oldResult);
  });

  it("the old invite behaviour would fail the baseline assertion", () => {
    expect(["hr"]).not.toEqual(planInternalInviteRoles("hr"));
  });
});

describe("the actions actually use the rule", () => {
  /**
   * A helper nobody calls is not a fix. This asserts the action module calls
   * both planners. Comments are stripped first — a comment describing the old
   * behaviour must not be able to satisfy a grep for it, which is the same trap
   * as a commented-out SQL constraint reading as a constraint.
   */
  const src = readFileSync(join(process.cwd(), "lib/admin/actions.ts"), "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("role change uses the planner rather than deleting everything", () => {
    expect(src).toContain("planFunctionalRoleChange(");

    // The delete must be SCOPED to the roles being replaced. Asserted by the
    // presence of the id filter, not by trying to pattern-match the whole
    // statement: a regex spanning a bare `.delete().eq("membership_id", …)`
    // also matched the fixed code, because its lazy `[^;]*?` happily ran past
    // the extra `.in("role_id", doomedRoleIds)` and matched the next `);`.
    // A guard that fires on correct code trains people to ignore it.
    const deleteCalls = src.match(/\.from\("membership_roles"\)[\s\S]{0,200}?\.delete\(\)/g) ?? [];
    expect(deleteCalls.length).toBeGreaterThan(0);
    const unscoped = deleteCalls.filter(
      (call) => !/\.in\("role_id"/.test(src.slice(src.indexOf(call), src.indexOf(call) + 400)),
    );
    expect(unscoped).toEqual([]);
  });

  it("invite uses the planner", () => {
    expect(src).toContain("planInternalInviteRoles(");
  });
});