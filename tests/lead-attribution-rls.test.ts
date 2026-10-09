import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `public.lead_attribution` carried `lead_attribution_insert` with
 * `WITH CHECK (true)` for `authenticated`, which Supabase's linter flags as
 * `rls_policy_always_true` (lint 0024). Any signed-in account, an applicant or a
 * client-portal user, could write attribution rows against any `lead_id`,
 * poisoning the CRM attribution data that sales reads.
 *
 * It was never needed. The only writer, `createLeadFromContact`, uses
 * `createAdminClient()` because the public marketing contact form is submitted by
 * an anonymous visitor with no `crm.manage` JWT, and the service role bypasses
 * RLS on this table (`relforcerowsecurity = false`). So the policy added nothing
 * to the product and everything to the attack surface.
 *
 * The temptation is to "re-add it for safety" if a write ever appears to break.
 * That is why these assertions scan *every* migration rather than the single file
 * carrying the fix: a guard that only reads the file where the bug was fixed
 * cannot see a different migration re-creating the same permissive policy, which
 * is the exact route by which the hole comes back.
 */
const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

/** These migrations *explain* the always-true policy in prose, so code assertions strip comments. */
const stripComments = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const allMigrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => {
    const raw = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    return { file: f, raw, code: stripComments(raw) };
  });

const FIX = "20261009120000_lead_attribution_insert_policy.sql";
const fix = allMigrations.find((m) => m.file === FIX);
const crmActions = readFileSync(join(process.cwd(), "lib/crm/actions.ts"), "utf8");

/**
 * Migrations that run AFTER the fix. `20260906001100_ats_crm_cms.sql` is where
 * the permissive policy was originally created, and it must not be edited: it is
 * applied to the live database, and rewriting applied migration history is worse
 * than the policy it contains. The invariant is therefore forward-looking — the
 * fix drops the policy and nothing after it may bring it back.
 */
const afterFix = allMigrations.filter((m) => m.file > FIX);

describe("lead_attribution insert policy", () => {
  it("found the migrations to scan, and scopes the forward checks correctly", () => {
    expect(allMigrations.length, "no migrations read; every check below would pass vacuously").toBeGreaterThan(20);
    expect(fix, `the dropping migration ${FIX} is missing`).toBeDefined();

    // The scoping has to actually exclude history, or the forward checks are
    // decorative. `20260906001100_ats_crm_cms.sql` is the original creator of the
    // permissive policy and must sort strictly before the fix.
    const creator = "20260906001100_ats_crm_cms.sql";
    expect(creator < FIX, "the original policy creator should sort before the fix").toBe(true);
    expect(afterFix.map((m) => m.file)).not.toContain(creator);
    expect(
      allMigrations.find((m) => m.file === creator)!.code,
      "the historical migration should still be readable, so the scan really is seeing it",
    ).toMatch(/create\s+policy\s+lead_attribution_insert/i);
  });

  it("drops the permissive insert policy", () => {
    expect(fix!.code).toMatch(
      /drop policy if exists lead_attribution_insert on public\.lead_attribution/,
    );
  });

  it("no later migration re-creates the permissive policy", () => {
    const offenders = afterFix
      .filter((m) => /create\s+policy\s+lead_attribution_insert/i.test(m.code))
      .map((m) => m.file);
    expect(
      offenders,
      `these migrations run after ${FIX} and re-create it, which is lint 0024:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("no later migration grants lead_attribution an always-true check, by any route", () => {
    // Catches the same hole arriving under a different policy name, or as a
    // table-wide permissive grant, which the name check above would miss.
    const offenders = afterFix
      .filter(
        (m) =>
          /lead_attribution/i.test(m.code) &&
          /with\s+check\s*\(\s*true\s*\)/i.test(m.code),
      )
      .map((m) => m.file);
    expect(
      offenders,
      `these migrations give public.lead_attribution an always-true WITH CHECK:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("leaves the read policy alone", () => {
    // Reads must stay gated on crm.read or crm.manage.
    const dropped = allMigrations
      .filter((m) => /drop\s+policy[^;]*lead_attribution_select/i.test(m.code))
      .map((m) => m.file);
    expect(dropped, "the read policy was dropped somewhere; reads are permission-gated").toEqual([]);
  });

  it("the only writer uses the service role, so it never needed the policy", () => {
    const writes = crmActions.match(/from\("lead_attribution"\)\s*\n?\s*\.insert/);
    expect(writes, "lead_attribution is no longer written from lib/crm/actions.ts; re-check this guard").not.toBeNull();

    expect(crmActions).toMatch(
      /createLeadFromContact[\s\S]{0,1200}createAdminClient\(\)/,
    );
    expect(crmActions).toMatch(
      /unauthenticated: public marketing form[\s\S]{0,200}createAdminClient/,
    );
  });

  it("records why the policy was unnecessary, so it is not re-added", () => {
    // Read the raw file: the reasoning lives in comments, which the code pass strips.
    expect(fix!.raw).toContain("rls_policy_always_true");
    expect(fix!.raw).toContain("service role bypasses");
    expect(fix!.raw).toContain("createAdminClient");
  });
});