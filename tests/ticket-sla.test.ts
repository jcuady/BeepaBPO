import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateTicketSla,
  slaCompliancePercent,
} from "@/lib/tickets/sla";

describe("evaluateTicketSla", () => {
  const created = "2026-09-07T00:00:00.000Z";
  const due = "2026-09-08T00:00:00.000Z"; // 24h

  it("returns none without sla_due_at", () => {
    expect(
      evaluateTicketSla({
        slaDueAt: null,
        status: "new",
        createdAt: created,
      }).state,
    ).toBe("none");
  });

  it("marks open tickets on_track before deadline", () => {
    expect(
      evaluateTicketSla({
        slaDueAt: due,
        status: "new",
        createdAt: created,
        now: new Date("2026-09-07T06:00:00.000Z"),
      }).state,
    ).toBe("on_track");
  });

  it("marks open tickets at_risk near deadline", () => {
    expect(
      evaluateTicketSla({
        slaDueAt: due,
        status: "in_progress",
        createdAt: created,
        now: new Date("2026-09-07T23:00:00.000Z"),
      }).state,
    ).toBe("at_risk");
  });

  it("marks open tickets breached after deadline", () => {
    expect(
      evaluateTicketSla({
        slaDueAt: due,
        status: "in_progress",
        createdAt: created,
        now: new Date("2026-09-08T01:00:00.000Z"),
      }).state,
    ).toBe("breached");
  });

  it("marks closed tickets met when resolved on time", () => {
    expect(
      evaluateTicketSla({
        slaDueAt: due,
        status: "resolved",
        resolvedAt: "2026-09-07T12:00:00.000Z",
        createdAt: created,
      }).state,
    ).toBe("met");
  });

  it("marks closed tickets breached when resolved late", () => {
    expect(
      evaluateTicketSla({
        slaDueAt: due,
        status: "closed",
        resolvedAt: "2026-09-09T00:00:00.000Z",
        createdAt: created,
      }).state,
    ).toBe("breached");
  });
});

describe("slaCompliancePercent", () => {
  it("returns null when no SLA tickets", () => {
    expect(slaCompliancePercent([{ slaDueAt: null, status: "new" }])).toBe(
      null,
    );
  });

  it("computes share not breached", () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    const pct = slaCompliancePercent(
      [
        {
          slaDueAt: "2026-09-08T00:00:00.000Z",
          status: "new",
          createdAt: "2026-09-07T00:00:00.000Z",
        },
        {
          slaDueAt: "2026-09-06T00:00:00.000Z",
          status: "new",
          createdAt: "2026-09-05T00:00:00.000Z",
        },
      ],
      now,
    );
    expect(pct).toBe(50);
  });
});

describe("ticket SLA seam", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260907210000_ticket_sla_defaults.sql",
    ),
    "utf8",
  );
  const actions = readFileSync(
    join(process.cwd(), "lib/tickets/actions.ts"),
    "utf8",
  );
  const clientDash = readFileSync(
    join(process.cwd(), "app/app/client/page.tsx"),
    "utf8",
  );
  const staffList = readFileSync(
    join(process.cwd(), "app/app/tickets/page.tsx"),
    "utf8",
  );

  it("seeds policies and applies SLA on insert", () => {
    expect(migration).toContain("tickets_apply_sla");
    expect(migration).toContain("ticket_sla_policies");
    expect(migration).toContain("11111111-1111-1111-1111-111111111111");
  });

  it("records first_response_at on staff reply", () => {
    expect(actions).toContain("first_response_at");
    expect(actions).toContain("tickets.manage");
  });

  it("surfaces SLA on client dashboard and staff queue", () => {
    expect(clientDash).toContain("slaCompliancePercent");
    expect(clientDash).toContain("SLA compliance");
    expect(staffList).toContain("TicketSlaBadge");
  });
});
