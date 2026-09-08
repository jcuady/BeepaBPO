import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("principal audit P1 seams", () => {
  it("leave cancel requires ConfirmDialog", () => {
    const src = readFileSync(
      join(process.cwd(), "components/app/leave/cancel-leave-button.tsx"),
      "utf8",
    );
    expect(src).toContain("ConfirmDialog");
    expect(src).toContain("destructive");
  });

  it("marketing proof strips are honest (no fake logos/stats)", () => {
    const trusted = readFileSync(
      join(process.cwd(), "components/marketing/trusted-by-section.tsx"),
      "utf8",
    );
    const proof = readFileSync(
      join(process.cwd(), "components/marketing/proof-strip.tsx"),
      "utf8",
    );
    expect(trusted).not.toContain("cdn.simpleicons.org");
    expect(trusted).not.toContain("google");
    expect(proof).not.toContain("500+");
    expect(proof).not.toContain("Maria Santos");
    expect(proof).not.toContain("picsum.photos");
  });

  it("client portal flags gate ticketing create + nav", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/tickets/actions.ts"),
      "utf8",
    );
    const nav = readFileSync(
      join(process.cwd(), "lib/app/navigation.ts"),
      "utf8",
    );
    const settings = readFileSync(
      join(process.cwd(), "lib/organizations/client-settings.ts"),
      "utf8",
    );
    expect(actions).toContain("allow_ticketing");
    expect(nav).toContain('portalFlag: "allowTicketing"');
    expect(nav).toContain('portalFlag: "allowBillingView"');
    expect(settings).toContain("loadClientPortalFlags");
  });
});
