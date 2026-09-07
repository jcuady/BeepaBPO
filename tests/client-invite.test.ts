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
});
