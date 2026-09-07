import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canActOnApprovalStep } from "@/lib/approvals/engine";
import type { WorkspaceContext } from "@/lib/auth/workspace";

function stubWorkspace(opts: {
  permissions: string[];
  roleCodes?: string[];
}): WorkspaceContext {
  return {
    user: { id: "u1" } as WorkspaceContext["user"],
    profile: {} as WorkspaceContext["profile"],
    permissions: new Set(opts.permissions),
    memberships: [
      {
        roles: (opts.roleCodes ?? []).map((code) => ({ code })),
      },
    ] as WorkspaceContext["memberships"],
    primaryMembership: null,
    isInternal: true,
    isClient: false,
    isApplicantOnly: false,
  };
}

describe("canActOnApprovalStep", () => {
  const hrStep = {
    id: "s1",
    step_order: 1,
    role_code: "hr",
    permission_code: "cash_advance.manage",
    name: "HR",
  };
  const financeStep = {
    id: "s2",
    step_order: 2,
    role_code: "finance",
    permission_code: "cash_advance.approve",
    name: "Finance",
  };

  it("returns false when step missing", () => {
    expect(
      canActOnApprovalStep(
        stubWorkspace({ permissions: ["cash_advance.manage"] }),
        undefined,
      ),
    ).toBe(false);
  });

  it("requires permission_code when set", () => {
    expect(
      canActOnApprovalStep(
        stubWorkspace({
          permissions: ["cash_advance.approve"],
          roleCodes: ["hr"],
        }),
        hrStep,
      ),
    ).toBe(false);
  });

  it("allows matching role + permission", () => {
    expect(
      canActOnApprovalStep(
        stubWorkspace({
          permissions: ["cash_advance.manage"],
          roleCodes: ["hr"],
        }),
        hrStep,
      ),
    ).toBe(true);
  });

  it("blocks wrong role even with permission", () => {
    expect(
      canActOnApprovalStep(
        stubWorkspace({
          permissions: ["cash_advance.approve"],
          roleCodes: ["hr"],
        }),
        financeStep,
      ),
    ).toBe(false);
  });

  it("lets system.manage bypass role after permission", () => {
    expect(
      canActOnApprovalStep(
        stubWorkspace({
          permissions: ["cash_advance.approve", "system.manage"],
          roleCodes: [],
        }),
        financeStep,
      ),
    ).toBe(true);
  });
});

describe("current-step Approve UI seam", () => {
  const engine = readFileSync(
    join(process.cwd(), "lib/approvals/engine.ts"),
    "utf8",
  );
  const leave = readFileSync(
    join(process.cwd(), "app/app/leave/page.tsx"),
    "utf8",
  );
  const cash = readFileSync(
    join(process.cwd(), "app/app/cash-advances/page.tsx"),
    "utf8",
  );
  const corrections = readFileSync(
    join(process.cwd(), "app/app/attendance/corrections/page.tsx"),
    "utf8",
  );
  const approvals = readFileSync(
    join(process.cwd(), "app/app/approvals/page.tsx"),
    "utf8",
  );

  it("exports mapPendingApprovalActability", () => {
    expect(engine).toContain("export async function mapPendingApprovalActability");
  });

  it("queues gate Approve on canAct", () => {
    expect(leave).toContain("mapPendingApprovalActability");
    expect(leave).toContain("Waiting for");
    expect(cash).toContain("mapPendingApprovalActability");
    expect(cash).toContain("act?.canAct");
    expect(corrections).toContain("mapPendingApprovalActability");
    expect(approvals).toContain("canActOnApprovalStep");
    expect(approvals).toContain("Waiting for");
  });
});
