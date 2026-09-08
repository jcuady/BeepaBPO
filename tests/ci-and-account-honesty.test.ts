import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CI workflow + account honesty seams", () => {
  const ci = readFileSync(
    join(process.cwd(), ".github/workflows/ci.yml"),
    "utf8",
  );
  const header = readFileSync(
    join(process.cwd(), "components/app/app-header.tsx"),
    "utf8",
  );
  const nav = readFileSync(
    join(process.cwd(), "lib/app/navigation.ts"),
    "utf8",
  );

  it("quotes AUTH_SECRET and does not gate jobs on secrets.*", () => {
    expect(ci).toContain('AUTH_SECRET: "beepa-ci-secret-change-me-32chars!!"');
    expect(ci).not.toMatch(/if:.*secrets\./);
    expect(ci).toContain("vars.RUN_E2E");
    expect(ci).not.toMatch(/pnpm\/action-setup@v4\s*\n\s*with:\s*\n\s*version:/);
    expect(ci).toContain("node-version: 22");
  });

  it("routes Settings and notifications to real pages", () => {
    expect(header).toContain('settingsHref: "/app/my/settings"');
    expect(header).toContain('notificationsHref: "/app/client/notifications"');
    expect(header).toContain(
      'notificationsHref: "/app/applicant/notifications"',
    );
  });

  it("exposes cash advances and payroll approval nav gates", () => {
    expect(nav).toContain("/app/my/cash-advances");
    expect(nav).toContain('"payroll.manage"');
    expect(nav).toContain('"payroll.approve"');
  });
});
