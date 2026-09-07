import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ticket assignment seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/tickets/actions.ts"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );
  const assignees = readFileSync(
    join(process.cwd(), "lib/tickets/assignees.ts"),
    "utf8",
  );
  const form = readFileSync(
    join(process.cwd(), "components/app/tickets/ticket-assign-form.tsx"),
    "utf8",
  );
  const detail = readFileSync(
    join(process.cwd(), "app/app/tickets/[id]/page.tsx"),
    "utf8",
  );
  const list = readFileSync(
    join(process.cwd(), "app/app/tickets/page.tsx"),
    "utf8",
  );

  it("exports assignTicket gated by tickets.manage", () => {
    expect(actions).toContain("export async function assignTicket");
    expect(actions).toContain('tickets.manage');
    expect(actions).toContain("assigned_user_id");
    expect(actions).toContain('action: "ticket.assign"');
    expect(validation).toContain("export const ticketAssignSchema");
  });

  it("lists Beepa internal assignees", () => {
    expect(assignees).toContain("export async function listTicketAssignees");
    expect(assignees).toContain("BEEPA_ORG_ID");
    expect(assignees).toContain('membership_type", "internal"');
  });

  it("wires assign UI on staff detail and assignee on queue", () => {
    expect(form).toContain("assignTicket");
    expect(detail).toContain("TicketAssignForm");
    expect(list).toContain("Assignee");
    expect(list).toContain("assignee:profiles!tickets_assigned_user_id_fkey");
  });
});
