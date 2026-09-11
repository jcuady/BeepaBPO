import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MARKETING_MODULE_PERMISSIONS,
  SALES_MODULE_PERMISSIONS,
  SALES_MARKETING_QA_ROUTES,
  modulePermissionsForRole,
} from "@/lib/permissions/role-modules";

/**
 * Seam: sales & marketing must be able to use CRM + staff ticketing.
 * Expected values are the product matrix literals — not derived from SQL parsing alone.
 */
describe("sales/marketing CRM + tickets module access", () => {
  it("sales has full CRM and staff ticket queue permissions", () => {
    expect(modulePermissionsForRole("sales")).toEqual([
      "crm.read",
      "crm.manage",
      "crm.reports",
      "clients.read",
      "reports.read",
      "tickets.read",
      "tickets.manage",
      "tickets.self",
    ]);
    for (const code of SALES_MODULE_PERMISSIONS) {
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("marketing has CRM + staff tickets alongside CMS", () => {
    expect(modulePermissionsForRole("marketing")).toEqual([
      "cms.manage",
      "crm.read",
      "crm.manage",
      "reports.read",
      "tickets.read",
      "tickets.manage",
      "tickets.self",
    ]);
    for (const code of MARKETING_MODULE_PERMISSIONS) {
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("QA routes cover CRM hub, leads/deals/proposals, and tickets", () => {
    expect(SALES_MARKETING_QA_ROUTES).toContain("/app/crm/leads");
    expect(SALES_MARKETING_QA_ROUTES).toContain("/app/tickets");
  });

  it("permission migration grants the matrix codes to both roles", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/20260911120000_sales_marketing_crm_tickets.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");
    for (const code of [
      ...SALES_MODULE_PERMISSIONS,
      ...MARKETING_MODULE_PERMISSIONS,
    ]) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toMatch(/_seed_role_perms\('sales'/);
    expect(sql).toMatch(/_seed_role_perms\('marketing'/);
  });

  it("baseline seed SQL also lists the expanded sales/marketing arrays", () => {
    const seedPath = resolve(
      process.cwd(),
      "supabase/migrations/20260906000600_seed_roles_permissions.sql",
    );
    const sql = readFileSync(seedPath, "utf8");
    const salesBlock = sql.slice(
      sql.indexOf("_seed_role_perms('sales'"),
      sql.indexOf("_seed_role_perms('marketing'"),
    );
    const marketingBlock = sql.slice(
      sql.indexOf("_seed_role_perms('marketing'"),
      sql.indexOf("_seed_role_perms('operations'"),
    );
    expect(salesBlock).toContain("'tickets.read'");
    expect(salesBlock).toContain("'tickets.manage'");
    expect(marketingBlock).toContain("'crm.read'");
    expect(marketingBlock).toContain("'crm.manage'");
    expect(marketingBlock).toContain("'tickets.read'");
    expect(marketingBlock).toContain("'tickets.manage'");
  });
});
