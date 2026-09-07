import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("crm proposals seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/crm/actions.ts"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );
  const page = readFileSync(
    join(process.cwd(), "app/app/crm/proposals/page.tsx"),
    "utf8",
  );
  const nav = readFileSync(
    join(process.cwd(), "lib/app/navigation.ts"),
    "utf8",
  );
  const dealDetail = readFileSync(
    join(process.cwd(), "app/app/crm/deals/[id]/page.tsx"),
    "utf8",
  );

  it("exports create and status update gated by crm.manage", () => {
    expect(actions).toContain("export async function createCrmProposal");
    expect(actions).toContain("export async function updateCrmProposalStatus");
    expect(actions).toMatch(
      /createCrmProposal[\s\S]*requirePermission\(workspace, "crm\.manage"\)/,
    );
    expect(actions).toContain('from("crm_proposals")');
    expect(validation).toContain("export const crmProposalSchema");
    expect(validation).toContain("export const crmProposalStatusSchema");
  });

  it("enforces draft→sent and sent→accepted/rejected transitions", () => {
    expect(actions).toContain('draft: ["sent", "withdrawn"]');
    expect(actions).toContain('sent: ["accepted", "rejected", "withdrawn"]');
  });

  it("exposes proposals list, nav, and deal detail wiring", () => {
    expect(page).toContain("CreateProposalForm");
    expect(page).toContain("ProposalStatusForm");
    expect(nav).toContain('href: "/app/crm/proposals"');
    expect(dealDetail).toContain("CreateProposalForm");
    expect(dealDetail).toContain("crm_proposals");
  });
});
