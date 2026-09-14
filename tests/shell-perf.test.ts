import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pickRoleLabel } from "@/lib/app/serialize-workspace";

describe("workspace shell latency", () => {
  it("resolves profile, memberships, and permissions in parallel", () => {
    const src = readFileSync(
      resolve("lib/auth/workspace.ts"),
      "utf8",
    );
    expect(src).toContain("Promise.all");
    expect(src).toContain('supabase.rpc("user_permission_codes")');
    const rpcAfterProfile = src.indexOf('from("profiles")');
    const rpcCall = src.indexOf('rpc("user_permission_codes")');
    expect(rpcCall).toBeGreaterThan(-1);
    expect(rpcAfterProfile).toBeGreaterThan(-1);
    expect(src.indexOf("await supabase.rpc")).toBe(-1);
  });

  it("does not block the app shell on an unread notification count", () => {
    const src = readFileSync(resolve("app/app/layout.tsx"), "utf8");
    expect(src).not.toMatch(/from\("notifications"\)/);
  });
});

describe("attendance clock surface", () => {
  it("renders ClockInOutCard on the employee attendance page", () => {
    const src = readFileSync(
      resolve("app/app/my/attendance/page.tsx"),
      "utf8",
    );
    expect(src).toContain("ClockInOutCard");
    expect(src).toContain("isClockedIn");
  });
});

describe("pickRoleLabel", () => {
  it("prefers Sales over a generic Employee role", () => {
    expect(
      pickRoleLabel(
        [
          { code: "employee", name: "Employee" },
          { code: "sales", name: "Sales" },
        ],
        "Employee",
      ),
    ).toBe("Sales");
  });

  it("keeps a lone Employee label", () => {
    expect(
      pickRoleLabel([{ code: "employee", name: "Employee" }], "Employee"),
    ).toBe("Employee");
  });
});
