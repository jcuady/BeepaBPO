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
    expect(actions).toMatch(
      /createCrmDeal[\s\S]*requirePermission\(workspace, "crm\.manage"\)/,
    );
    expect(actions).toMatch(
      /updateCrmDealStage[\s\S]*requirePermission\(workspace, "crm\.manage"\)/,
    );
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
});
