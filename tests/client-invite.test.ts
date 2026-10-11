import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("client org invite slice", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/clients/actions.ts"),
    "utf8",
  );
  const form = readFileSync(
    join(process.cwd(), "components/app/clients/client-invite-form.tsx"),
    "utf8",
  );
  const page = readFileSync(
    join(process.cwd(), "lib/app/admin-pages.tsx"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );

  it("gates inviteClientUser on clients.manage", () => {
    expect(actions).toContain("export async function inviteClientUser");
    expect(actions).toContain('requirePermission(workspace, "clients.manage")');
    expect(actions).toContain("clients.invite");
    expect(actions).toContain('membership_type: "client"');
    expect(actions).toContain('redirectNext: "/app/client"');
  });

  it("only allows client_admin and client_viewer roles", () => {
    expect(validation).toContain("clientInviteSchema");
    expect(validation).toMatch(
      /clientInviteSchema[\s\S]*role_code: z\.enum\(\["client_admin", "client_viewer"\]\)/,
    );
    expect(form).toContain("client_admin");
    expect(form).toContain("client_viewer");
    expect(form).not.toContain('"owner"');
  });

  it("wires invite form on clients page", () => {
    expect(page).toContain("ClientInviteForm");
    expect(form).toContain("inviteClientUser");
  });

  it("rejects non-client organizations", () => {
    expect(actions).toContain('org.type !== "client"');
  });

  /**
   * The role lookup is a cheap local read. It used to run AFTER
   * `inviteOrResolveAuthUser`, which creates a real auth user and sends a real
   * invitation email. A missing or mis-seeded `client_admin` row therefore
   * aborted the action only after both of those had already happened, leaving an
   * orphaned auth user and an invitation for access that did not exist.
   *
   * Asserted as an index comparison rather than a `toContain`, because
   * `toContain` was exactly what let this defect through: both statements were
   * present, in the wrong order, and every existing assertion still passed.
   */
  it("resolves the role before taking any irreversible action", () => {
    const roleLookup = actions.indexOf('from("roles")');
    const invite = actions.indexOf("await inviteOrResolveAuthUser(");
    expect(roleLookup).toBeGreaterThan(-1);
    expect(invite).toBeGreaterThan(-1);
    expect(roleLookup).toBeLessThan(invite);
  });

  /**
   * Ordering alone cannot cover the failures that happen after a successful
   * invite: the membership upsert and the membership_roles upsert both run after
   * the account exists. Those paths must undo the account.
   *
   * The gate is `invited === true` and the gate has to be visible in the source,
   * because the alternative failure is far worse than the one being fixed: if
   * rollback ever ran for a user the action merely *linked* (invited === false),
   * it would delete a real colleague's account. `invitedOrResolveAuthUser` returns
   * `invited: false` precisely when it found an existing user by paging through
   * `listUsers`.
   */
  it("rolls back an account it created when provisioning fails after the invite", () => {
    expect(actions).toContain("deleteUser");
    expect(actions).toMatch(/invited\s*===\s*true/);
    // Rollback must not fire on the resolve-an-existing-user path.
    expect(actions).not.toMatch(/if\s*\(\s*!invited\s*\)/);
  });

  /**
   * The profile write was awaited but its result discarded, so a failed update
   * produced a provisioned user with no name and an action that reported success.
   */
  it("checks the profile update it performs", () => {
    expect(actions).toMatch(
      /const\s*\{\s*error:\s*profileError\s*\}\s*=\s*await\s*admin\s*\.from\("profiles"\)\s*\.update\(/,
    );
  });

  /**
   * The four mappers in `lib/auth/error-messages.ts` share one `authFailureKind`.
   * The invite path used to return `inviteError?.message` raw, so a 429 reached
   * the user as "email rate limit exceeded". Assert the raw field is gone from the
   * helper and the mapper is called instead.
   */
  it("routes the invite failure through the shared error mapper", () => {
    const helper = readFileSync(
      join(process.cwd(), "lib/auth/invite-user.ts"),
      "utf8",
    );
    expect(helper).toContain("inviteErrorMessage");
    expect(helper).not.toMatch(/error:\s*inviteError\?\.message/);
  });
});
