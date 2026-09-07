import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("crm deals pipeline wiring", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/crm/actions.ts"),
    "utf8",
  );
  const dealsPage = readFileSync(
    join(process.cwd(), "app/app/crm/deals/page.tsx"),
    "utf8",
  );
  const nav = readFileSync(
    join(process.cwd(), "lib/app/navigation.ts"),
    "utf8",
  );
  const hub = readFileSync(
    join(process.cwd(), "lib/app/admin-pages.tsx"),
    "utf8",
  );

  it("gates deal mutations on crm.manage", () => {
    expect(actions).toContain("export async function createCrmDeal");
    expect(actions).toContain("export async function updateCrmDealStage");
    expect(actions).toContain("export async function convertWonDealToClient");
    expect(actions).toMatch(
      /createCrmDeal[\s\S]*requirePermission\(workspace, "crm\.manage"\)/,
    );
    expect(actions).toMatch(
      /updateCrmDealStage[\s\S]*requirePermission\(workspace, "crm\.manage"\)/,
    );
    expect(actions).toMatch(
      /convertWonDealToClient[\s\S]*crm\.manage[\s\S]*clients\.manage/,
    );
  });

  it("requires won stage and links client organization", () => {
    expect(actions).toContain('deal.stage !== "won"');
    expect(actions).toContain("client_organization_id");
    expect(actions).toContain('from("client_settings")');
  });

  it("requires lost_reason when stage is lost", () => {
    expect(actions).toContain('nextStage === "lost"');
    expect(actions).toContain("Lost reason is required");
  });

  it("exposes deals list and nav", () => {
    expect(dealsPage).toContain('requirePermission(workspace, "crm.read")');
    expect(dealsPage).toContain("CreateDealForm");
    expect(nav).toContain('href: "/app/crm/deals"');
    expect(hub).toContain('href="/app/crm/deals"');
  });

  it("deal detail can convert won deals", () => {
    const detail = readFileSync(
      join(process.cwd(), "app/app/crm/deals/[id]/page.tsx"),
      "utf8",
    );
    expect(detail).toContain("ConvertDealToClientForm");
    expect(detail).toContain('deal.stage === "won"');
  });
});
