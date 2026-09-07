import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("email digest seam", () => {
  const send = readFileSync(join(process.cwd(), "lib/email/send.ts"), "utf8");
  const digest = readFileSync(
    join(process.cwd(), "lib/notifications/email-digest.ts"),
    "utf8",
  );
  const cron = readFileSync(
    join(process.cwd(), "lib/jobs/cron-jobs.ts"),
    "utf8",
  );
  const ui = readFileSync(
    join(process.cwd(), "components/app/notifications-page-client.tsx"),
    "utf8",
  );
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260907200000_email_digest_sent_at.sql",
    ),
    "utf8",
  );

  it("sends via Resend HTTP without SDK", () => {
    expect(send).toContain("api.resend.com/emails");
    expect(send).toContain("RESEND_API_KEY");
    expect(send).toContain("Idempotency-Key");
  });

  it("cron runs notification_digest and respects email_enabled", () => {
    expect(cron).toContain("notification_digest");
    expect(digest).toContain("email_enabled");
    expect(digest).toContain("email_digest_sent_at");
    expect(migration).toContain("email_digest_sent_at");
  });

  it("notifications UI exposes email digests preference", () => {
    expect(ui).toContain('["email_enabled", "Email digests"]');
  });
});
