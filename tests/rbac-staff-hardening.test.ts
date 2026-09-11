import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getCommandLinks } from "@/lib/app/navigation";

describe("RBAC staff surface hardening", () => {
  it("Cmd+K does not expose admin routes to clients", () => {
    const links = getCommandLinks(
      ["tickets.read", "tickets.manage", "reports.read", "reports.export"],
      true,
      false,
      false,
    );
    const hrefs = links.map((l) => l.href);
    expect(hrefs).not.toContain("/app/tickets");
    expect(hrefs).not.toContain("/app/tickets/sla");
    expect(hrefs).not.toContain("/app/reports");
    expect(hrefs).not.toContain("/app/crm");
  });

  it("Cmd+K exposes tickets to internal staff with tickets.read", () => {
    const links = getCommandLinks(["tickets.read"], false, true, false);
    expect(links.map((l) => l.href)).toContain("/app/tickets");
  });

  it("SLA page and actions require tickets.manage + clients.manage", () => {
    const slaPage = readFileSync(
      resolve(process.cwd(), "app/app/tickets/sla/page.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      resolve(process.cwd(), "lib/tickets/actions.ts"),
      "utf8",
    );
    expect(slaPage).toContain("requireAllPermissions");
    expect(slaPage).toContain("requireInternal");
    expect(actions).toContain('["tickets.manage", "clients.manage"]');
  });

  it("staff tickets + corrections require internal workspace", () => {
    const tickets = readFileSync(
      resolve(process.cwd(), "app/app/tickets/page.tsx"),
      "utf8",
    );
    const corrections = readFileSync(
      resolve(process.cwd(), "app/app/attendance/corrections/page.tsx"),
      "utf8",
    );
    const review = readFileSync(
      resolve(process.cwd(), "lib/attendance/corrections.ts"),
      "utf8",
    );
    expect(tickets).toContain("requireInternal");
    expect(corrections).toContain("requireInternal");
    expect(review).toContain("Staff access required.");
  });

  it("permission harden migration strips client staff codes and scopes corrections RLS", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260911150000_harden_client_applicant_perms.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("client_admin");
    expect(sql).toContain("tickets.read");
    expect(sql).toContain("applicant");
    expect(sql).toContain("recruitment.read");
    expect(sql).toContain("attendance_correction_requests_select");
    expect(sql).toContain("is_internal_user()");
  });

  it("tickets staff RLS migration requires is_internal_user for org-wide read", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260911160000_tickets_staff_rls.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("tickets_select");
    expect(sql).toContain("is_internal_user()");
    expect(sql).toContain("tickets.self");
  });
});
