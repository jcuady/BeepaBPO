import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formatZonedDate } from "@/lib/attendance/zoned-time";

/**
 * Three NTE defects, none of which the release gate could see.
 *
 * 1. `createNteCase` stored `response_due_at` straight from a `datetime-local`
 *    input. Postgres casts a bare timestamp as UTC, so a 17:00 Manila deadline
 *    stored `17:00Z` and rendered as the *next* day to the employee. Same shape
 *    as the attendance correction bug, one module over.
 *
 * 2. `submitNteResponse` inserted the response and then updated the case status,
 *    but `nte_cases` UPDATE is gated on `nte.manage` and an employee holds only
 *    `nte.self`. RLS rejected the update, the error was never read, and the
 *    action returned "Response submitted." anyway. The fix routes both halves
 *    through one SECURITY DEFINER function.
 *
 * 3. The `/app/hr/nte` search box read `q`, echoed it back and passed it to the
 *    pager, but never applied it to the query. The "Page wiring (no dead
 *    controls)" gate step passed throughout, because the control does render and
 *    does submit — it is only ignored afterwards.
 *
 * The behavioural proofs live in `scripts/audit/qa-exercise-nte-workflow.mjs`
 * (24/24, driven through a browser against the real database). These assertions
 * pin the *shape* of the fixes so they cannot be quietly reverted.
 */
const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const nteActions = read("lib/hr/nte-actions.ts");
const ntePage = read("app/app/hr/nte/page.tsx");
const myNtePage = read("app/app/my/nte/page.tsx");
const migration = read("supabase/migrations/20261010120000_nte_response_submission.sql");

describe("NTE response deadline is stored as a real instant", () => {
  it("converts the naive datetime-local value instead of passing it through", () => {
    expect(nteActions).toContain("naiveDateTimeToZoned");
    // The old line stored the submitted string verbatim.
    expect(nteActions).not.toContain("response_due_at: parsed.data.response_due_at");
  });

  it("resolves the timezone from the employee, defaulting to Manila", () => {
    expect(nteActions).toMatch(/default_timezone/);
    expect(nteActions).toMatch(/employeeRow\?\.default_timezone \|\| DEFAULT_TIMEZONE/);
  });

  it("renders the deadline in a timezone rather than the host's", () => {
    // `format(new Date(row.response_due_at), ...)` renders in whatever zone the host
    // runs in, which is how a stored instant reaches the employee a day off.
    expect(myNtePage).toContain("formatZonedDate");
    expect(myNtePage).not.toMatch(/Due \$\{format\(new Date\(row\.response_due_at\)/);
  });
});

describe("formatZonedDate", () => {
  it("shows the calendar day in the named timezone", () => {
    // 17:00 Manila is 09:00 UTC the same day.
    expect(formatZonedDate("2026-03-09T09:00:00.000Z", "Asia/Manila")).toBe("Mar 9, 2026");
    // The same instant is already the 10th in Auckland (UTC+13).
    expect(formatZonedDate("2026-03-09T09:00:00.000Z", "Pacific/Auckland")).toBe("Mar 9, 2026");
    // And one that really does cross the date line, to prove it is not a constant.
    expect(formatZonedDate("2026-03-09T23:00:00.000Z", "Asia/Manila")).toBe("Mar 10, 2026");
  });

  it("returns an em dash for missing or unparseable input", () => {
    expect(formatZonedDate(null)).toBe("—");
    expect(formatZonedDate("not-a-date")).toBe("—");
  });
});

describe("an employee cannot silently fail to move their own case", () => {
  // Scoped to `submitNteResponse` on purpose. `resolveNteCase` still updates
  // `nte_cases`, and that is correct — HR holds `nte.manage`. A file-wide assertion
  // would flag that legitimate write as the defect it is trying to prevent.
  const respondFn = nteActions.slice(
    nteActions.indexOf("export async function submitNteResponse"),
    nteActions.indexOf("export async function resolveNteCase"),
  );

  it("routes the response and the status change through one RPC", () => {
    expect(respondFn).toContain('supabase.rpc("submit_nte_response"');
    // The old shape: insert here, silently-rejected update there.
    expect(respondFn).not.toMatch(/from\("nte_cases"\)\s*\.update\(/);
    expect(respondFn).not.toMatch(/from\("nte_responses"\)\s*\.insert\(/);
  });

  it("reads the error instead of discarding it", () => {
    // A bare `await supabase...` with no destructured `error` is the original defect.
    expect(respondFn).not.toMatch(/await supabase\s*\.from\(/);
    expect(respondFn).toContain("NTE_NOT_FOUND_OR_NOT_OWNED");
    expect(respondFn).toContain("CASE_NOT_OPEN");
  });

  it("keeps the write narrow instead of granting UPDATE on nte_cases", () => {
    // The tempting "fix" is a `for update` policy on is_self_employee(employee_id).
    // RLS cannot restrict columns, so that would let an employee set
    // resolution_type / resolved_by / resolved_at on their own Notice to Explain —
    // mark it cleared, or record a dismissal against themselves.
    expect(migration).toContain("security definer");
    expect(migration).not.toMatch(/grant\s+update\s+on\s+(table\s+)?public\.nte_cases/i);
    expect(migration).not.toMatch(/create\s+policy[\s\S]{0,120}nte_cases[\s\S]{0,60}for\s+update/i);
  });

  it("cannot resolve a case from inside the response function", () => {
    const fn = migration.slice(migration.indexOf("create or replace function public.submit_nte_response"));
    expect(fn).not.toMatch(/resolution_type\s*=/);
    expect(fn).not.toMatch(/resolved_at\s*=/);
    expect(fn).toContain("under_review");
  });
});

describe("the HR NTE search box is wired to its query", () => {
  it("applies the search pattern instead of only echoing it", () => {
    expect(ntePage).toContain("ilikePattern");
    expect(ntePage).toMatch(/\.or\(`subject\.ilike\.\$\{pattern\},case_number\.ilike\.\$\{pattern\}`\)/);
  });

  it("carries the status filter into the query too", () => {
    // `status` was declared and used for the dropdown, but never reached `.eq()`.
    expect(ntePage).toMatch(/caseQuery\s*=\s*caseQuery\.eq\("status",\s*status\)/);
  });
});

describe("negative controls", () => {
  it("catches the deadline conversion being reverted", () => {
    const regressed = nteActions
      .replace(/naiveDateTimeToZoned\(parsed\.data\.response_due_at, timeZone\)/, "parsed.data.response_due_at")
      .replace(/employeeRow\?\.default_timezone \|\| DEFAULT_TIMEZONE/, '"Asia/Manila"');
    // The positive assertions would fail on this source.
    expect(regressed).not.toContain("naiveDateTimeToZoned(parsed.data.response_due_at, timeZone)");
    expect(regressed).not.toMatch(/employeeRow\?\.default_timezone \|\| DEFAULT_TIMEZONE/);
  });

  it("catches a blanket UPDATE grant sneaking into the migration", () => {
    const regressed = migration.replace(
      "revoke all on function public.submit_nte_response(uuid, text) from public;",
      "grant update on public.nte_cases to authenticated;\nrevoke all on function public.submit_nte_response(uuid, text) from public;",
    );
    expect(regressed).toMatch(/grant\s+update\s+on\s+(table\s+)?public\.nte_cases/i);
    expect(regressed).not.toBe(migration);
  });

  it("catches the search filter being dropped again", () => {
    const regressed = ntePage.replace(/\.or\(`subject\.ilike\.\$\{pattern\},case_number\.ilike\.\$\{pattern\}`\)/, "");
    expect(regressed).not.toMatch(/\.or\(`subject\.ilike/);
  });
});