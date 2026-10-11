import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fetchAllByRange } from "@/lib/pagination/fetch-all";

/**
 * The silent-cap class, proved on the code rather than on the demo data.
 *
 * `/app/client/approvals` capped a client's queue at 40 with no pager. `createPayrollPeriod`
 * capped payroll seeding at 500 active employees **with no `.order()` at all**, and still
 * returned `ok: true`. `listTicketAssignees` capped assignees at 100. All three are the same
 * bug: a `.limit()` where the author meant "all of them".
 *
 * None is reachable with today's data — the org has 10 active employees and 13 internal
 * members — so a browser test cannot exercise them. This proves the paging instead, against
 * a stub that serves more rows than any cap, and additionally asserts that the old call
 * sites are gone. A future `.limit()` on either query fails here rather than in production.
 */

const payrollActionsRaw = readFileSync("lib/payroll/actions.ts", "utf8");
const assigneesRaw = readFileSync("lib/tickets/assignees.ts", "utf8");
const fetchAllRaw = readFileSync("lib/pagination/fetch-all.ts", "utf8");

/**
 * Strip comments before asserting on source.
 *
 * Three of these assertions were wrong on the first run because they matched the PROSE that
 * explains the fix — a comment saying "the previous `.limit(100)`" reads as exactly the
 * pattern the assertion was trying to prove absent. An assertion about what the code does
 * must not be satisfiable, or falsifiable, by what the comment says about it.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|\s)\/\/.*$/, "$1"))
    .join("\n");
}

const payrollActions = code(payrollActionsRaw);
const assignees = code(assigneesRaw);
const fetchAll = code(fetchAllRaw);
const fetchAllProse = fetchAllRaw;

/** A stub that serves `total` rows over `.range(from, to)` calls, recording what was asked. */
function stubServer(total: number, pageSizeSeen: number[] = []) {
  return (from: number, to: number) => {
    const size = to - from + 1;
    pageSizeSeen.push(size);
    const start = from;
    const end = Math.min(to + 1, total);
    return Promise.resolve({
      data: Array.from({ length: Math.max(0, end - start) }, (_, i) => ({ id: `row-${start + i}` })),
      error: null,
    });
  };
}

describe("fetchAllByRange — no silent cap", () => {
  it("returns every row when the set is far larger than one page", async () => {
    // 1200 rows at a 500 page size: three pages. The old `.limit(500)` would have returned
    // 500 and the caller could not have told the difference.
    const rows = await fetchAllByRange(stubServer(1200), {
      pageSize: 500,
      maxPages: 200,
      label: "test",
    });
    expect(rows).toHaveLength(1200);
    expect(rows[0].id).toBe("row-0");
    expect(rows[1199].id).toBe("row-1199");
  });

  it("stops on a short page instead of asking for one more", async () => {
    // 120 rows at 100 per page: two full pages then a 20-row page that ends the walk. A
    // fourth request would mean the loop is not respecting a short final page.
    const pages: number[] = [];
    const rows = await fetchAllByRange(stubServer(120, pages), {
      pageSize: 100,
      maxPages: 50,
      label: "test",
    });
    expect(rows).toHaveLength(120);
    expect(pages).toEqual([100, 100]);
  });

  it("handles a set smaller than one page with a single request", async () => {
    const pages: number[] = [];
    const rows = await fetchAllByRange(stubServer(10, pages), {
      pageSize: 500,
      maxPages: 200,
      label: "test",
    });
    expect(rows).toHaveLength(10);
    expect(pages).toEqual([500]); // asked for 500, got 10, stopped
  });

  it("returns every row when the set is exactly one full page", async () => {
    const rows = await fetchAllByRange(stubServer(500), {
      pageSize: 500,
      maxPages: 200,
      label: "test",
    });
    expect(rows).toHaveLength(500);
  });

  it("FAILS LOUDLY past maxPages rather than returning a partial list", async () => {
    // This is the property that distinguishes "no cap" from "a bigger cap": past the limit
    // the caller gets an error, not a list that looks complete.
    await expect(
      fetchAllByRange(stubServer(100_000), { pageSize: 100, maxPages: 2, label: "test" }),
    ).rejects.toThrow(/exceeded 2 pages of 100/);
  });

  it("propagates a page error with the page number, naming what failed", async () => {
    let calls = 0;
    await expect(
      fetchAllByRange(
        () => {
          calls += 1;
          return Promise.resolve(calls === 2 ? { data: null, error: { message: "boom" } } : { data: [{ id: "a" }], error: null });
        },
        { pageSize: 1, maxPages: 10, label: "Loading employees" },
      ),
    ).rejects.toThrow(/Loading employees failed on page 2: boom/);
  });
});

describe("the silent caps are gone from the call sites", () => {
  it("payroll seeding no longer caps employees", () => {
    expect(payrollActions).toContain("listAllActiveEmployees");
    // The dangerous shape specifically: an active-employee query with a bare limit.
    expect(payrollActions).not.toMatch(/employment_status["']\s*\)\s*\n\s*\.limit\(/);
  });

  it("payroll employee paging has a unique order, so range() cannot skip or duplicate", () => {
    expect(fetchAll).toMatch(/\.order\("id", \{ ascending: true \}\)/);
    // The reason is documented in prose; assert it is still written down, because the next
    // person to touch this is exactly the person who will "simplify" the order away.
    expect(fetchAllProse).toMatch(/ORDER IS LOAD-BEARING/i);
  });

  it("ticket assignees no longer cap, and tie-break a non-unique order", () => {
    expect(assignees).toContain("fetchAllByRange");
    expect(assignees).not.toMatch(/\.limit\(/);
    // created_at alone is not unique; id must be the tiebreaker.
    expect(assignees).toMatch(/\.order\("created_at", \{ ascending: true \}\)\s*\n\s*\.order\("id", \{ ascending: true \}\)/);
  });

  it("the helper is a separate module, because 'use server' cannot export a plain function", () => {
    expect(payrollActionsRaw.startsWith('"use server"')).toBe(true);
    expect(fetchAllRaw.startsWith('"use server"')).toBe(false);
  });
});