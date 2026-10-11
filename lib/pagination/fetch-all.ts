import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Fetch every row of a large set by walking `.range()` in pages.
 *
 * WHY THIS EXISTS
 * Several places in this codebase reached for `.limit(N)` where they actually meant "all of
 * them, however many there are". A `.limit()` there is a silent data-loss bug, not a
 * performance measure: the caller cannot tell the difference between "there were 500" and
 * "there were more and we stopped looking", and the code that follows goes on to behave as
 * though it saw everything. Two of those were found and fixed in the same pass:
 *
 *   - `createPayrollPeriod` seeded draft payroll records for `.limit(500)` active employees,
 *     with no `.order()` at all, so which 500 was arbitrary and the action still reported
 *     success. Anyone dropped had no payroll record and nothing said so.
 *   - `listTicketAssignees` offered only `.limit(100)` internal members as assignees, so a
 *     101st teammate simply could not be put on a ticket.
 *
 * A third, `/app/client/approvals`, had the same shape and was found by sweeping the same
 * pattern class.
 *
 * THE ORDER IS LOAD-BEARING
 * `.range()` paging over an order that is not TOTAL is unsafe: PostgREST breaks ties
 * arbitrarily, so two pages can overlap or skip rows, turning a silent omission into a
 * silent DUPLICATE. Callers must order by something unique, or by a unique tiebreaker
 * after a non-unique column. The payroll call orders by `id`; the assignee call orders by
 * `created_at` then `id` because it wants creation order.
 *
 * FAILING LOUDLY
 * `maxPages` is a backstop, not a target. A dataset past it returns a thrown error rather
 * than a partial list, because a partial list that looks complete is worse than an error.
 */
export async function fetchAllByRange<T>(
  run: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  options: { pageSize: number; maxPages: number; label: string },
): Promise<T[]> {
  const { pageSize, maxPages, label } = options;
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await run(from, from + pageSize - 1);
    if (error) {
      throw new Error(`${label} failed on page ${page + 1}: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }

  throw new Error(
    `${label} exceeded ${maxPages} pages of ${pageSize} (${maxPages * pageSize} rows) and was stopped rather than returning a partial list.`,
  );
}

/**
 * All active employees in the Beepa org, with no upper bound.
 *
 * Exists as a separate module rather than inline in `lib/payroll/actions.ts` because that
 * file is `"use server"`, where every export must be an async server action and a plain
 * helper cannot be exported for a unit test. Keeping it here also makes the paging itself
 * testable against a stub client, which is the only way to prove the >500 path when the
 * demo org has ten employees.
 */
export async function listAllActiveEmployees(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<{ id: string }[]> {
  const PAGE = 500;
  return fetchAllByRange<{ id: string }>(
    (from, to) =>
      supabase
        .from("employees")
        .select("id")
        .eq("organization_id", orgId)
        .eq("employment_status", "active")
        // Unique, so the order is total and paging cannot skip or repeat.
        .order("id", { ascending: true })
        .range(from, to),
    { pageSize: PAGE, maxPages: 200, label: "Loading active employees for payroll seeding" },
  );
}