import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ticket SLA policy admin seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/tickets/actions.ts"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );
  const page = readFileSync(
    join(process.cwd(), "app/app/tickets/sla/page.tsx"),
    "utf8",
  );
  const nav = readFileSync(
    join(process.cwd(), "lib/app/navigation.ts"),
    "utf8",
  );
  const form = readFileSync(
    join(process.cwd(), "components/app/tickets/ticket-sla-policy-form.tsx"),
    "utf8",
  );

  it("exports create/update SLA policy gated by tickets.manage", () => {
    expect(actions).toContain("export async function updateTicketSlaPolicy");
    expect(actions).toContain("export async function createTicketSlaPolicy");
    expect(actions).toContain("tickets.manage");
    expect(actions).toContain("ticket_sla_policies");
    expect(validation).toContain("export const ticketSlaPolicyUpdateSchema");
    expect(validation).toContain("export const ticketSlaPolicyCreateSchema");
  });

  it("wires SLA admin page and nav", () => {
    expect(page).toContain("TicketSlaPolicyForm");
    expect(page).toContain("tickets.manage");
    expect(page).toContain("BEEPA_ORG_ID");
    expect(nav).toContain('href: "/app/tickets/sla"');
    expect(form).toContain("updateTicketSlaPolicy");
  });
});
