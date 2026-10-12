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

  it("landing page makes no fabricated trust claims", () => {
    // Retargeted when the landing page was replaced by the reference design.
    // The components this used to read (trusted-by-section, proof-strip) no
    // longer exist; the rule they enforced still does: no invented client
    // logos, no invented named testimonials, no invented headcounts, and no
    // placeholder image hosts.
    const landing = readFileSync(
      join(process.cwd(), "components/landing/landing-page.tsx"),
      "utf8",
    );
    expect(landing).not.toContain("cdn.simpleicons.org");
    expect(landing).not.toContain("Nexora");
    expect(landing).not.toContain("picsum.photos");
    expect(landing).not.toContain("Maria Santos");
    expect(landing).not.toMatch(/\b500\+/);
    expect(landing).not.toMatch(/\b\d{3,}\+?\s*(clients|customers|companies)\b/i);
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
