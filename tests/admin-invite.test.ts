import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin invite slice", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/admin/actions.ts"),
    "utf8",
  );
  const inviteHelper = readFileSync(
    join(process.cwd(), "lib/auth/invite-user.ts"),
    "utf8",
  );
  const page = readFileSync(
    join(process.cwd(), "app/app/admin/users/page.tsx"),
    "utf8",
  );
  const form = readFileSync(
    join(process.cwd(), "components/app/admin/admin-invite-form.tsx"),
    "utf8",
  );
  const hire = readFileSync(
    join(process.cwd(), "lib/recruitment/actions.ts"),
    "utf8",
  );

  it("gates inviteInternalUser on system.manage", () => {
    expect(actions).toContain("export async function inviteInternalUser");
    expect(actions).toContain('requirePermission(workspace, "system.manage")');
    expect(actions).toContain("users.invite");
  });

  it("uses shared inviteOrResolveAuthUser helper", () => {
    expect(inviteHelper).toContain("inviteUserByEmail");
    expect(actions).toContain("inviteOrResolveAuthUser");
    expect(hire).toContain("inviteOrResolveAuthUser");
  });

  it("wires AdminInviteForm on users page with invited list", () => {
    expect(form).toContain("inviteInternalUser");
    expect(page).toContain("AdminInviteForm");
    expect(page).toContain('["active", "invited"]');
  });

  it("does not expose owner/super_admin in invite form", () => {
    expect(form).not.toContain('"owner"');
    expect(form).not.toContain('"super_admin"');
  });
});
