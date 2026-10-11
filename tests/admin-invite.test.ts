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

  /**
   * Same defect as `inviteClientUser`, fixed the same way. The role lookup is a
   * cheap local read that ran after `inviteOrResolveAuthUser` had already created
   * an auth user and emailed an invitation, so a missing role row left an orphan
   * behind and told the admin the invite had failed.
   *
   * Asserted by index, because `toContain` passed while the defect was present:
   * both statements existed, in the wrong order.
   */
  it("resolves the role before taking any irreversible action", () => {
    const roleLookup = actions.indexOf('from("roles")');
    const invite = actions.indexOf("await inviteOrResolveAuthUser(");
    expect(roleLookup).toBeGreaterThan(-1);
    expect(invite).toBeGreaterThan(-1);
    expect(roleLookup).toBeLessThan(invite);
  });

  it("rolls back an account it created when provisioning fails after the invite", () => {
    expect(actions).toContain("deleteUser");
    expect(actions).toMatch(/invited\s*===\s*true/);
    expect(actions).not.toMatch(/if\s*\(\s*!invited\s*\)/);
  });

  it("checks the profile update it performs", () => {
    expect(actions).toMatch(
      /const\s*\{\s*error:\s*profileError\s*\}\s*=\s*await\s*admin\s*\.from\("profiles"\)\s*\.update\(/,
    );
  });

  /**
   * The self-service baseline step is the one post-invite failure that must NOT
   * roll back: membership and the primary role already exist at that point, so
   * the account works. Asserted so a future blanket "wrap it all in the rollback"
   * edit cannot quietly destroy a usable login.
   */
  it("keeps the account when only the self-service baseline fails", () => {
    const baseline = actions.indexOf("baselineError");
    expect(baseline).toBeGreaterThan(-1);
    const window = actions.slice(baseline, baseline + 400);
    expect(window).not.toContain("rollbackCreatedUser");
  });

  it("routes the invite failure through the shared error mapper", () => {
    expect(inviteHelper).toContain("inviteErrorMessage");
    expect(inviteHelper).not.toMatch(/error:\s*inviteError\?\.message/);
  });
});
