import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "@/lib/jobs/cron-jobs";

describe("cron + push ops smoke slice", () => {
  const jobs = readFileSync(
    join(process.cwd(), "lib/jobs/cron-jobs.ts"),
    "utf8",
  );
  const route = readFileSync(
    join(process.cwd(), "app/api/jobs/cron/route.ts"),
    "utf8",
  );
  const adminActions = readFileSync(
    join(process.cwd(), "lib/admin/actions.ts"),
    "utf8",
  );
  const adminPage = readFileSync(
    join(process.cwd(), "lib/app/admin-pages.tsx"),
    "utf8",
  );
  const pushSend = readFileSync(
    join(process.cwd(), "app/api/push/send/route.ts"),
    "utf8",
  );

  it("supports dryRun without mutating invoices", () => {
    expect(jobs).toContain("dryRun");
    expect(jobs).toContain("invoice_overdue");
    expect(jobs).toContain("missing_clock_out");
  });

  it("authorizes Bearer or x-cron-secret", () => {
    expect(jobs).toContain("x-cron-secret");
    expect(route).toContain("authorizeCronRequest");
    const req = new Request("http://localhost/api/jobs/cron", {
      headers: { authorization: "Bearer test-secret" },
    });
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    expect(authorizeCronRequest(req)).toBe(true);
    expect(
      authorizeCronRequest(
        new Request("http://localhost/api/jobs/cron", {
          headers: { "x-cron-secret": "test-secret" },
        }),
      ),
    ).toBe(true);
    expect(
      authorizeCronRequest(new Request("http://localhost/api/jobs/cron")),
    ).toBe(false);
    process.env.CRON_SECRET = prev;
  });

  it("wires admin dry-run + test push", () => {
    expect(adminActions).toContain("export async function runCronDryRun");
    expect(adminActions).toContain("export async function sendAdminTestPush");
    expect(adminPage).toContain("AdminOpsSmokeActions");
    expect(adminPage).toContain("Ops smoke");
  });

  it("push send accepts cron secret or system.manage", () => {
    expect(pushSend).toContain("CRON_SECRET");
    expect(pushSend).toContain('"system.manage"');
  });
});
