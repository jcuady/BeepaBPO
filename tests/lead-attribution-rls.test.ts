import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `public.lead_attribution` carried `lead_attribution_insert` with
 * `WITH CHECK (true)` for `authenticated`, which Supabase's linter flags as
 * `rls_policy_always_true` (lint 0024). Any signed-in account — an applicant, a
 * client-portal user, anyone — could write attribution rows against any
 * `lead_id`, poisoning the CRM attribution data that sales reads.
 *
 * It was never needed. The only writer, `createLeadFromContact`, uses
 * `createAdminClient()` because the public marketing contact form is submitted by
 * an anonymous visitor with no `crm.manage` JWT, and the service role bypasses
 * RLS on this table (`relforcerowsecurity = false`). So the policy added nothing
 * to the product and everything to the attack surface.
 *
 * The temptation is to "re-add it for safety" if a write ever appears to break,
 * which is why this asserts both the absence of the policy AND why the app path
 * does not need it.
 */
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261009120000_lead_attribution_insert_policy.sql"),
  "utf8",
);
// Strip comments first: the migration *explains* the always-true policy in prose,
// so asserting against the raw text would fail on the very documentation that
// justifies the fix.
const migrationCode = migration
  .replace(/--[^\n]*/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const crmActions = readFileSync(join(process.cwd(), "lib/crm/actions.ts"), "utf8");

describe("lead_attribution insert policy", () => {
  it("drops the permissive insert policy", () => {
    expect(migrationCode).toMatch(
      /drop policy if exists lead_attribution_insert on public\.lead_attribution/,
    );
  });

  it("never recreates it, and leaves no always-true check anywhere in the file", () => {
    // The first version of this guard only asserted the DROP was present, so it
    // still passed when a `create policy ... with check (true)` was appended
    // immediately afterwards. Asserting the absence of the re-creation is the
    // check that actually prevents the hole from coming back.
    expect(
      migrationCode,
      "the migration recreates lead_attribution_insert after dropping it",
    ).not.toMatch(/create\s+policy\s+lead_attribution_insert/i);
    expect(
      migrationCode,
      "an always-true WITH CHECK is exactly lint 0024 and must not appear in this file",
    ).not.toMatch(/with\s+check\s*\(\s*true\s*\)/i);
  });

  it("leaves the SELECT policy alone", () => {
    // Reading attribution must still require crm.read or crm.manage.
    expect(migrationCode).not.toMatch(/drop policy[^;]*lead_attribution_select/);
  });

  it("the only writer uses the service role, so it never needed the policy", () => {
    const writes = crmActions.match(/from\("lead_attribution"\)\s*\n?\s*\.insert/);
    expect(writes, "lead_attribution is no longer written from lib/crm/actions.ts; re-check this guard").not.toBeNull();

    // The function that writes it must be the public, unauthenticated one.
    expect(crmActions).toMatch(
      /createLeadFromContact[\s\S]{0,1200}createAdminClient\(\)/,
    );
    // And it must not build a user-scoped client for this write.
    expect(crmActions).toMatch(
      /unauthenticated: public marketing form[\s\S]{0,200}createAdminClient/,
    );
  });

  it("records why the policy was unnecessary, so it is not re-added", () => {
    expect(migration).toContain("rls_policy_always_true");
    expect(migration).toContain("service role bypasses");
    expect(migration).toContain("createAdminClient");
  });
});