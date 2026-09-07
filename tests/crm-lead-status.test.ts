import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CRM lead status update slice", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/crm/actions.ts"),
    "utf8",
  );
  const list = readFileSync(
    join(process.cwd(), "app/app/crm/leads/page.tsx"),
    "utf8",
  );
  const detail = readFileSync(
    join(process.cwd(), "app/app/crm/leads/[id]/page.tsx"),
    "utf8",
  );
  const form = readFileSync(
    join(process.cwd(), "components/app/crm/lead-status-form.tsx"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );

  it("exports updateCrmLeadStatus with crm.manage gate", () => {
    expect(actions).toContain("export async function updateCrmLeadStatus");
    const start = actions.indexOf("export async function updateCrmLeadStatus");
    const body = actions.slice(start, start + 800);
    expect(body).toContain('requirePermission(workspace, "crm.manage")');
  });

  it("validates status enum via crmLeadStatusSchema", () => {
    expect(validation).toContain("crmLeadStatusSchema");
    expect(validation).toContain('"converted"');
    expect(validation).toContain('"lost"');
  });

  it("wires LeadStatusForm on list and detail", () => {
    expect(form).toContain("updateCrmLeadStatus");
    expect(list).toContain("LeadStatusForm");
    expect(detail).toContain("LeadStatusForm");
    expect(detail).toContain('requirePermission(workspace, "crm.read")');
  });

  it("logs activity + audit on status change", () => {
    const start = actions.indexOf("export async function updateCrmLeadStatus");
    const body = actions.slice(start);
    expect(body).toContain('from("crm_activities")');
    expect(body).toContain("crm_lead.status_update");
  });
});
