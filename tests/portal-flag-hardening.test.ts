import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("portal flag + dual-membership hardening", () => {
  it("client billing detail respects allow_billing_view", () => {
    const page = readFileSync(
      resolve(process.cwd(), "app/app/client/billing/[id]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("allow_billing_view");
    expect(page).toContain("notFound()");
  });

  it("client requests and tickets respect allow_ticketing", () => {
    const requests = readFileSync(
      resolve(process.cwd(), "app/app/client/requests/page.tsx"),
      "utf8",
    );
    const nav = readFileSync(
      resolve(process.cwd(), "lib/app/navigation.ts"),
      "utf8",
    );
    expect(requests).toContain("allow_ticketing");
    expect(requests).toContain("Requests unavailable");
    expect(nav).toMatch(/href: "\/app\/client\/requests"[\s\S]*portalFlag: "allowTicketing"/);
  });

  it("client timesheets and approvals hard-block when approval off", () => {
    const timesheets = readFileSync(
      resolve(process.cwd(), "app/app/client/timesheets/page.tsx"),
      "utf8",
    );
    const approvals = readFileSync(
      resolve(process.cwd(), "app/app/client/approvals/page.tsx"),
      "utf8",
    );
    expect(timesheets).toContain("Timesheets unavailable");
    expect(approvals).toContain("Approvals unavailable");
  });

  it("Send to client allows internal even if also client membership", () => {
    const actions = readFileSync(
      resolve(process.cwd(), "lib/attendance/client-timesheet.ts"),
      "utf8",
    );
    expect(actions).toContain("isClient && !workspace.isInternal");
    expect(actions).toContain("Staff access required.");
  });

  it("payroll and admin staff actions require internal", () => {
    const payroll = readFileSync(
      resolve(process.cwd(), "lib/payroll/actions.ts"),
      "utf8",
    );
    const admin = readFileSync(
      resolve(process.cwd(), "lib/admin/actions.ts"),
      "utf8",
    );
    expect(payroll).toContain("Staff access required.");
    expect(admin).toContain("Staff access required.");
  });
});
