import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The audit's body-copy rule is a character count, and a character count cannot
 * tell body copy from a label. It reads
 * `No employee record is linked to your account, so uploads are unavailable.`
 * as body copy and `₱12,000` as a label, purely on length — which is why two
 * real 14px violations in shared components passed until their seed text
 * happened to cross 25 characters:
 *
 *   - /app/my/documents `category · date`   (teamlead's name tripped it)
 *   - notification body in notifications-page-client.tsx
 *
 * `data-meta` is the semantic replacement: it says "this is secondary metadata"
 * explicitly, and does not change when the data does. The risk of any opt-out
 * is that it becomes a blanket exemption, so these tests pin that it is applied
 * to metadata and NOT to body copy.
 */

const auditSrc = readFileSync("scripts/audit-app-responsive.mjs", "utf8");

function read(p: string) {
  return readFileSync(p, "utf8");
}

describe("data-meta body-copy opt-out", () => {
  it("is honoured by the audit, and checked BEFORE the length heuristic", () => {
    expect(auditSrc).toContain('if (el.closest("[data-meta]")) continue;');
    const optOut = auditSrc.indexOf('if (el.closest("[data-meta]")) continue;');
    const heuristic = auditSrc.indexOf("if (text.length < 25) continue;");
    expect(optOut).toBeGreaterThan(-1);
    expect(optOut).toBeLessThan(heuristic);
  });

  it("is applied to real metadata — ticket number, clock time, invoice period, amount", () => {
    expect(read("app/app/my/requests/page.tsx")).toMatch(/<p data-meta className="text-sm text-slate">[\s\S]{0,120}ticket_number/);
    expect(read("app/app/my/attendance/page.tsx")).toMatch(/<p data-meta className="text-sm text-slate">[\s\S]{0,80}clock_in_at/);
    expect(read("components/app/billing/invoice-detail-view.tsx")).toMatch(
      /<p data-meta className="mt-1 text-sm text-slate">[\s\S]{0,120}clientName/,
    );
    expect(read("app/app/crm/deals/[id]/page.tsx")).toMatch(
      /<p data-meta className="mt-1 text-sm text-slate">[\s\S]{0,80}money\(proposal\.amount/,
    );
  });

  it("is NOT applied to body copy — a reason, a description or a message body is body copy", () => {
    // These four were the real latent violations. Marking them `data-meta` would
    // silence the very check that exists to catch them, so the exemption is
    // pinned to the opposite of what it should be.
    for (const p of [
      "app/app/my/cash-advances/page.tsx",
      "app/app/my/nte/page.tsx",
      "app/app/my/requests/[id]/page.tsx",
    ]) {
      expect(read(p)).not.toMatch(/<p data-meta[^>]*>\s*\{\{?(row\.reason|row\.description|ticket\.description|msg\.body)/);
    }
    expect(read("components/app/notifications-page-client.tsx")).not.toContain("data-meta");
  });

  it("leaves the body-copy sites at 16px on phones and 14px on desktop", () => {
    // `md:` is a MIN-width breakpoint, so this order is the only correct one:
    // `text-sm md:text-base` would give phones 14px and desktops 16px, which is
    // precisely backwards — a mistake this repository has already made once.
    const expectBumped = (p: string, needle: string) =>
      expect(read(p)).toMatch(
        new RegExp(`className="[^"]*text-base[^"]*md:text-sm[^"]*"[\\s\\S]{0,80}${needle}`),
      );
    expectBumped("app/app/my/cash-advances/page.tsx", "row\\.reason");
    expectBumped("app/app/my/nte/page.tsx", "row\\.description");
    expectBumped("app/app/my/requests/[id]/page.tsx", "ticket\\.description");
    expectBumped("app/app/my/requests/[id]/page.tsx", "msg\\.body");
    expectBumped("app/app/my/documents/page.tsx", "doc\\.category");
    expect(read("components/app/notifications-page-client.tsx")).toContain(
      "text-base text-slate sm:text-sm",
    );
  });
});