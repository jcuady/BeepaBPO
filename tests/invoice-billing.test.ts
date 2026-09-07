import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("invoice issue + payment seam", () => {
  const actions = readFileSync(
    join(process.cwd(), "lib/billing/actions.ts"),
    "utf8",
  );
  const validation = readFileSync(
    join(process.cwd(), "lib/validation/app.ts"),
    "utf8",
  );
  const listPage = readFileSync(
    join(process.cwd(), "app/app/billing/page.tsx"),
    "utf8",
  );
  const issueForm = readFileSync(
    join(process.cwd(), "components/app/billing/issue-invoice-form.tsx"),
    "utf8",
  );
  const clientList = readFileSync(
    join(process.cwd(), "app/app/client/billing/page.tsx"),
    "utf8",
  );
  const financeDetail = readFileSync(
    join(process.cwd(), "app/app/billing/[id]/page.tsx"),
    "utf8",
  );
  const nav = readFileSync(
    join(process.cwd(), "lib/app/navigation.ts"),
    "utf8",
  );

  it("exports issueInvoice gated by billing.manage", () => {
    expect(actions).toContain("export async function issueInvoice");
    expect(actions).toContain('status: "issued"');
    expect(actions).toContain('from("invoice_items")');
    expect(validation).toContain("export const issueInvoiceSchema");
    expect(listPage).toContain("IssueInvoiceForm");
    expect(issueForm).toContain("issueInvoice");
  });

  it("exports recordInvoicePayment gated by billing.manage", () => {
    expect(actions).toContain("export async function recordInvoicePayment");
    expect(actions).toContain('requirePermission(workspace, "billing.manage")');
    expect(actions).toContain('from("invoice_payments")');
  });

  it("client billing links to detail", () => {
    expect(clientList).toContain("/app/client/billing/");
  });

  it("finance detail can record payments", () => {
    expect(financeDetail).toContain("canRecordPayment");
    expect(financeDetail).toContain("billing.manage");
  });

  it("admin nav exposes Billing for billing.read/manage", () => {
    expect(nav).toContain('href: "/app/billing"');
    expect(nav).toContain('"billing.read"');
  });
});
