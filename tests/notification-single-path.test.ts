import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The application notifies in application code. A migration that also creates
 * the notification as a table trigger produces two notifications, not one.
 *
 * `20261006140000_realtime_and_profile_sync.sql` originally created both
 * `notify_ticket_created` and `notify_leave_request`. It was never applied, so
 * the fix was free — but only if the application path is what actually delivers
 * those notifications. That is what these tests assert: the trigger is gone AND
 * the app-side call that replaces it exists.
 */
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006140000_realtime_and_profile_sync.sql",
  ),
  "utf8",
);

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("notification delivery has exactly one path", () => {
  it("creates no ticket/leave notification trigger in the migration", () => {
    // Strip comments so the file's own explanation of what it no longer does
    // does not satisfy the assertion.
    const code = migration
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");

    expect(code).not.toMatch(/create or replace function public\.notify_/i);
    expect(code).not.toMatch(/insert into public\.notifications/i);
    expect(code).not.toMatch(/create trigger\s+\w*notif/i);
  });

  it("still delivers the ticket notification from the application", () => {
    // Removing the trigger must not remove the notification. If this ever fails,
    // the correct response is to fix the application path, not to restore a
    // duplicate trigger.
    const actions = read("lib/tickets/actions.ts");
    expect(actions).toMatch(/notifyUser\(\{[\s\S]{0,200}type:\s*"ticket\.created"/);
    // ...and to the creator, which is who the trigger would also have targeted.
    expect(actions).toMatch(/userId:\s*workspace\.user\.id/);
  });

  it("still delivers the leave notification to the approver, not the submitter", () => {
    const leave = read("lib/leave/actions.ts");
    expect(leave).toMatch(/notifyUser\(\{[\s\S]{0,200}type:\s*"leave\.request"/);
    // The app notifies reviewing memberships. The removed trigger notified
    // `new.employee_id` — the submitter — which is why it was wrong.
    expect(leave).toMatch(/membership/);
  });

  it("keeps the realtime publication changes the migration exists for", () => {
    // Guard against "fixing" the duplication by deleting the whole migration.
    for (const table of [
      "notifications",
      "leave_requests",
      "approval_requests",
      "payroll_records",
      "ticket_messages",
    ]) {
      expect(migration).toContain(
        `alter publication supabase_realtime add table public.${table}`,
      );
    }
    expect(migration).toContain("handle_user_sign_in");
  });
});