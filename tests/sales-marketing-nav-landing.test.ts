import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { landingPathFor } from "@/lib/auth/landing";
import { getAdminNavGroups } from "@/lib/app/navigation";
import {
  MARKETING_ADMIN_NAV_HREFS,
  MARKETING_MODULE_PERMISSIONS,
  SALES_ADMIN_NAV_HREFS,
  SALES_MARKETING_FORBIDDEN_NAV_HREFS,
  SALES_MODULE_PERMISSIONS,
  modulePermissionsForRole,
} from "@/lib/permissions/role-modules";

describe("landingPathFor role hubs", () => {
  it("lands sales on CRM hub", () => {
    expect(
      landingPathFor({
        membershipCount: 1,
        isApplicantOnly: false,
        isInternal: true,
        isClient: false,
        permissions: [...SALES_MODULE_PERMISSIONS],
      }),
    ).toBe("/app/crm");
  });

  it("lands marketing on CMS (CRM stays in nav)", () => {
    expect(
      landingPathFor({
        membershipCount: 1,
        isApplicantOnly: false,
        isInternal: true,
        isClient: false,
        permissions: [...MARKETING_MODULE_PERMISSIONS],
      }),
    ).toBe("/app/cms");
  });
});

describe("sales/marketing admin nav surfaces", () => {
  it("sales sees CRM + clients + tickets + reports only", () => {
    const hrefs = getAdminNavGroups([...SALES_MODULE_PERMISSIONS])
      .flatMap((g) => g.items)
      .map((i) => i.href)
      .sort();
    expect(hrefs).toEqual([...SALES_ADMIN_NAV_HREFS].sort());
    for (const forbidden of SALES_MARKETING_FORBIDDEN_NAV_HREFS) {
      expect(hrefs).not.toContain(forbidden);
    }
  });

  it("marketing sees CMS + CRM + tickets + reports (no clients/SLA)", () => {
    const hrefs = getAdminNavGroups([...MARKETING_MODULE_PERMISSIONS])
      .flatMap((g) => g.items)
      .map((i) => i.href)
      .sort();
    expect(hrefs).toEqual([...MARKETING_ADMIN_NAV_HREFS].sort());
    expect(hrefs).not.toContain("/app/clients");
    for (const forbidden of SALES_MARKETING_FORBIDDEN_NAV_HREFS) {
      expect(hrefs).not.toContain(forbidden);
    }
  });

  it("modulePermissionsForRole stays aligned with nav expectations", () => {
    expect(modulePermissionsForRole("sales")).toContain("clients.read");
    expect(modulePermissionsForRole("marketing")).toContain("cms.manage");
    expect(modulePermissionsForRole("marketing")).toContain("crm.manage");
  });
});

describe("CRM/tickets perf indexes migration", () => {
  it("ships created_at/updated_at and trigram indexes", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260911140000_crm_tickets_perf_indexes.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("crm_leads_created_at_idx");
    expect(sql).toContain("crm_leads_company_trgm_idx");
    expect(sql).toContain("tickets_status_created_idx");
    expect(sql).toContain("gin_trgm_ops");
  });
});
