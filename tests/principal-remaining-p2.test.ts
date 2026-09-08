import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("principal remaining P2 seams", () => {
  it("payroll recalculate and send-to-client use ConfirmDialog", () => {
    const recalc = readFileSync(
      join(process.cwd(), "components/app/payroll/recalculate-button.tsx"),
      "utf8",
    );
    const send = readFileSync(
      join(
        process.cwd(),
        "components/app/attendance/submit-for-client-review-button.tsx",
      ),
      "utf8",
    );
    expect(recalc).toContain("ConfirmDialog");
    expect(send).toContain("ConfirmDialog");
  });

  it("postTicketMessage hard-locks client replies when ticketing off", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/tickets/actions.ts"),
      "utf8",
    );
    const detail = readFileSync(
      join(process.cwd(), "app/app/client/tickets/[id]/page.tsx"),
      "utf8",
    );
    expect(actions).toContain("export async function postTicketMessage");
    expect(actions).toContain("allow_ticketing");
    expect(actions).toContain("!isStaff && ticket.client_organization_id");
    expect(detail).toContain("loadClientPortalFlags");
    expect(detail).toContain("allowTicketing");
  });

  it("employee update gates on employees.manage and wires form", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/employees/actions.ts"),
      "utf8",
    );
    const page = readFileSync(
      join(process.cwd(), "app/app/employees/[id]/page.tsx"),
      "utf8",
    );
    const form = readFileSync(
      join(process.cwd(), "components/app/employees/employee-edit-form.tsx"),
      "utf8",
    );
    expect(actions).toContain("export async function updateEmployee");
    expect(actions).toContain('can(workspace.permissions, "employees.manage")');
    expect(actions).toContain("employees.update");
    expect(form).toContain("updateEmployee");
    expect(page).toContain("EmployeeEditForm");
    expect(page).toContain("employees.manage");
  });

  it("admin membership role change and revoke protect owner/super_admin", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/admin/actions.ts"),
      "utf8",
    );
    const page = readFileSync(
      join(process.cwd(), "app/app/admin/users/page.tsx"),
      "utf8",
    );
    const ui = readFileSync(
      join(
        process.cwd(),
        "components/app/admin/admin-membership-actions.tsx",
      ),
      "utf8",
    );
    expect(actions).toContain("export async function updateInternalMembershipRole");
    expect(actions).toContain("export async function revokeMembership");
    expect(actions).toContain('requirePermission(workspace, "system.manage")');
    expect(actions).toContain("owner");
    expect(actions).toContain("super_admin");
    expect(actions).toContain("users.revoke");
    expect(actions).toContain("users.role_change");
    expect(ui).toContain("ConfirmDialog");
    expect(ui).not.toContain('"owner"');
    expect(ui).not.toContain('"super_admin"');
    expect(page).toContain("AdminMembershipActions");
  });
});
