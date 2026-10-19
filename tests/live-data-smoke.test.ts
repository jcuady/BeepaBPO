// Live data presence smoke test.
// Verifies the seeded demo data is present in the live Supabase project.
// This is a *connectivity + data* test, not a logic test. Skips when env is absent.
//
// Run:  pnpm vitest run tests/live-data-smoke.test.ts
import { readFileSync, existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, test, beforeAll, expect, vi } from "vitest";

// Every assertion in this file is a round-trip to a remote Postgres over the
// internet, and several tests issue five to eight of them. Vitest's 5s default
// is a budget for in-process logic, not for a networked integration suite, so
// the whole file failed intermittently while every assertion was true. Individual
// tests still fail fast on a real hang; this only widens the network allowance.
vi.setConfig({ testTimeout: 20_000 });

function loadEnv(file: string) {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, idx).trim()] = v;
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env") };
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const SKIP = !URL || !KEY;

const describeIf = SKIP ? describe.skip : describe;

describeIf("live data smoke (nwvnawgxkzwiercllgmg)", () => {
  let sb: SupabaseClient;
  beforeAll(() => {
    sb = createClient(URL!, KEY!, { auth: { persistSession: false } });
  });

  async function count(table: string) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  }

  test("auth users — 13 demo users", async () => {
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
    expect(error).toBeNull();
    expect(data?.users?.length).toBeGreaterThanOrEqual(13);
  });

  test("CMS tables are populated", async () => {
    expect(await count("services")).toBeGreaterThanOrEqual(10);
    expect(await count("industries")).toBeGreaterThanOrEqual(5);
    expect(await count("testimonials")).toBeGreaterThanOrEqual(3);
    expect(await count("case_studies")).toBeGreaterThanOrEqual(3);
    expect(await count("blog_posts")).toBeGreaterThanOrEqual(4);
    expect(await count("faqs")).toBeGreaterThanOrEqual(6);
    expect(await count("site_settings")).toBeGreaterThanOrEqual(3);
  });

  test("HR workforce data is present", async () => {
    expect(await count("employees")).toBeGreaterThanOrEqual(10);
    expect(await count("departments")).toBeGreaterThanOrEqual(3);
    expect(await count("teams")).toBeGreaterThanOrEqual(3);
    expect(await count("payroll_profiles")).toBeGreaterThanOrEqual(8);
    expect(await count("holiday_calendars")).toBeGreaterThanOrEqual(2);
    expect(await count("holidays")).toBeGreaterThanOrEqual(10);
  });

  test("Attendance / leave workflows have data", async () => {
    expect(await count("leave_types")).toBeGreaterThanOrEqual(6);
    expect(await count("leave_balances")).toBeGreaterThanOrEqual(20);
    expect(await count("leave_requests")).toBeGreaterThanOrEqual(1);
    expect(await count("shift_assignments")).toBeGreaterThanOrEqual(5);
  });

  test("Payroll pipeline complete", async () => {
    expect(await count("payroll_periods")).toBeGreaterThanOrEqual(1);
    expect(await count("payroll_records")).toBeGreaterThanOrEqual(5);
    expect(await count("payslips")).toBeGreaterThanOrEqual(1);
    expect(await count("payroll_components")).toBeGreaterThanOrEqual(1);
  });

  test("HR discipline + cash advance workflow data", async () => {
    expect(await count("cash_advance_requests")).toBeGreaterThanOrEqual(1);
    expect(await count("approval_requests")).toBeGreaterThanOrEqual(1);
    expect(await count("nte_cases")).toBeGreaterThanOrEqual(1);
  });

  test("Client portal data is real", async () => {
    expect(await count("client_profiles")).toBeGreaterThanOrEqual(1);
    expect(await count("client_settings")).toBeGreaterThanOrEqual(1);
    expect(await count("client_contacts")).toBeGreaterThanOrEqual(1);
    expect(await count("invoices")).toBeGreaterThanOrEqual(1);
    expect(await count("invoice_items")).toBeGreaterThanOrEqual(1);
    expect(await count("billing_accounts")).toBeGreaterThanOrEqual(1);
  });

  test("Tickets + CRM have data", async () => {
    expect(await count("tickets")).toBeGreaterThanOrEqual(1);
    expect(await count("ticket_messages")).toBeGreaterThanOrEqual(1);
    expect(await count("crm_leads")).toBeGreaterThanOrEqual(2);
    expect(await count("crm_deals")).toBeGreaterThanOrEqual(1);
    expect(await count("crm_proposals")).toBeGreaterThanOrEqual(1);
  });

  test(
    "ATS + performance data",
    async () => {
      // Eight sequential round-trips against a remote database sat right on
      // vitest's 5s default, so this failed intermittently on a busy machine while
      // every assertion was in fact true. They are independent reads, so issue
      // them together and keep an explicit ceiling for the network.
      const [
        jobPosts,
        applicants,
        jobApplications,
        stageHistory,
        interviews,
        assessments,
        cycles,
        kpis,
      ] = await Promise.all([
        count("job_posts"),
        count("applicants"),
        count("job_applications"),
        count("application_stage_history"),
        count("interviews"),
        count("assessments"),
        count("performance_cycles"),
        count("performance_kpis"),
      ]);

      expect(jobPosts).toBeGreaterThanOrEqual(1);
      expect(applicants).toBeGreaterThanOrEqual(1);
      expect(jobApplications).toBeGreaterThanOrEqual(1);
      expect(stageHistory).toBeGreaterThanOrEqual(1);
      expect(interviews).toBeGreaterThanOrEqual(1);
      expect(assessments).toBeGreaterThanOrEqual(1);
      expect(cycles).toBeGreaterThanOrEqual(1);
      expect(kpis).toBeGreaterThanOrEqual(2);
    },
    20_000,
  );

  test("No duplicate bereavement leave for demo employee", async () => {
    // After dedupe we expect at most 1 bereavement row per (employee, dates).
    const { data } = await sb
      .from("leave_requests")
      .select("id, employee_id, start_at, end_at, leave_types!inner(code)")
      .eq("leave_types.code", "BEREAVEMENT");
    const seen = new Set<string>();
    for (const l of data ?? []) {
      const k = `${l.employee_id}|${l.start_at}|${l.end_at}`;
      expect(seen.has(k), `duplicate bereavement row: ${k}`).toBe(false);
      seen.add(k);
    }
  });

  test("profile.last_login_at synced for demo users", async () => {
    const { data } = await sb.from("profiles").select("id, last_login_at");
    const synced = (data ?? []).filter((p) => p.last_login_at).length;
    expect(synced).toBeGreaterThanOrEqual(10);
  });

  test("the public site_settings carry no retired brand spelling", async () => {
    // Read with the ANON key, not the service key. `public_seo`, `public_contact`
    // and `public_social` are the three `site_settings` rows the RLS policy
    // exposes to an anonymous visitor, so the question is not "what does the
    // database contain" but "what does the PUBLIC get".
    //
    // The retired spelling was live here until 2026-10-19: `public_seo` served
    // "BeepoBPO | People-First BPO Outsourcing Partner" to anyone who asked,
    // while the site's own metadata came from `lib/site.ts` and said "Beepa
    // BPO". The source tree does not describe this row, so a source-level
    // check cannot see it -- only a read of the live public surface can.
    const anon = createClient(URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    const { data, error } = await anon
      .from("site_settings")
      .select("key, value")
      .in("key", ["public_seo", "public_contact", "public_social"]);

    expect(error, "anonymous read of the public settings failed").toBeNull();
    // Not vacuous: if the anon policy changed and this read returned nothing,
    // every assertion below would pass for the wrong reason.
    expect(data?.length, "the anon read returned no public settings").toBe(3);

    for (const row of data ?? []) {
      const serialised = JSON.stringify(row.value);
      expect(
        serialised,
        `${row.key} still publishes the retired brand spelling`,
      ).not.toMatch(/BeepoBPO/i);
    }

    // And the row that names the site names it the way the site does.
    const seo = (data ?? []).find((r) => r.key === "public_seo");
    const seoValue = (seo?.value ?? {}) as Record<string, string>;
    expect(String(seoValue.title ?? ""), "public_seo title").toContain("Beepa BPO");
  });

  test("Stuck ticket TKT-DEMO-0001 was re-opened with an SLA", async () => {
    // This used to assert `sla_due_at > Date.now()` and failed on 2026-10-14 with
    // every assertion about the CODE true, because the seed had set the SLA to
    // "now + 3 days" on 2026-10-10. The value decayed to a fixed moment in the
    // past and no amount of correct code could turn it back: a test that reads the
    // wall clock against seeded demo data is guaranteed to rot, and when it does
    // it looks exactly like a product regression.
    //
    // The durable invariant is that the re-open ASSIGNED an SLA, not that the SLA
    // is still unbreached. An open ticket legitimately breaches its SLA over time
    // — that is the feature. Assert the assignment instead.
    const { data } = await sb
      .from("tickets")
      .select("status, sla_due_at, created_at")
      .eq("ticket_number", "TKT-DEMO-0001")
      .maybeSingle();

    expect(data, "seed ticket TKT-DEMO-0001 is missing").not.toBeNull();
    expect(data!.status, "the stuck ticket should not still be 'new'").not.toBe("new");

    expect(data!.sla_due_at, "re-opening must assign an SLA").toBeTruthy();
    expect(
      new Date(data!.sla_due_at!).getTime(),
      "the assigned SLA must be later than the ticket's creation",
    ).toBeGreaterThan(new Date(data!.created_at!).getTime());
  });
});