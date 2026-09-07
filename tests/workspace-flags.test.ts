import { describe, expect, it } from "vitest";
import { computeWorkspaceFlags } from "@/lib/auth/workspace-flags";
import {
  canReadAssignedAttendance,
  canSeeEmployeeDirectory,
} from "@/lib/permissions/attendance-scope";

describe("workspace flags", () => {
  it("treats applicant-only membership as not internal", () => {
    const flags = computeWorkspaceFlags([
      {
        membership_type: "applicant",
        status: "active",
        organization: { type: "internal" },
        roles: [{ scope: "applicant" }],
      },
    ]);
    expect(flags.isInternal).toBe(false);
    expect(flags.isClient).toBe(false);
    expect(flags.isApplicantOnly).toBe(true);
  });

  it("keeps staff with employee role internal", () => {
    const flags = computeWorkspaceFlags([
      {
        membership_type: "internal",
        status: "active",
        organization: { type: "internal" },
        roles: [{ scope: "internal" }, { scope: "internal" }],
      },
    ]);
    expect(flags.isInternal).toBe(true);
    expect(flags.isApplicantOnly).toBe(false);
  });
});

describe("attendance / directory isolation", () => {
  it("lets a client see assigned staff attendance only", () => {
    expect(
      canReadAssignedAttendance({
        isSelf: false,
        isInternal: false,
        isAssignedToCurrentClient: true,
        hasAttendanceRead: true,
      }),
    ).toBe(true);
    expect(
      canReadAssignedAttendance({
        isSelf: false,
        isInternal: false,
        isAssignedToCurrentClient: false,
        hasAttendanceRead: true,
      }),
    ).toBe(false);
  });

  it("hides the employee directory from clients without assignment", () => {
    expect(
      canSeeEmployeeDirectory({
        isSelf: false,
        isInternal: false,
        isAssignedToCurrentClient: false,
        hasEmployeesRead: false,
        hasEmployeeVisibility: true,
      }),
    ).toBe(false);
  });
});
