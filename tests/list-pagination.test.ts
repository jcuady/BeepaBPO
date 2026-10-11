import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function src(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * Comments removed before asserting on code.
 *
 * `app/app/client/timesheets/page.tsx` documents its own fix with the literal
 * text `.limit(40)` — so a naive `.not.toMatch(/\.limit\(40\)/)` fails on the
 * explanation of the fix. `scripts/audit-design-system.mjs` strips comments for
 * exactly this reason; the same rule applies here.
 */
function code(path: string) {
  return src(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

/**
 * Every page under `app/` that renders a `ListPager`.
 *
 * Discovered rather than listed by hand so a newly paginated page is covered
 * the day it is written. A hand-kept list is exactly how this defect class
 * comes back: nobody adds the new page to the old list.
 */
function listPagerPages(): string[] {
  const root = join(process.cwd(), "app");
  return tsxFiles(root)
    .map((file) => relative(process.cwd(), file))
    .filter((path) => src(path).includes("ListPager"))
    .sort();
}

describe("hot list pagination", () => {
  it("tickets page uses range + ListPager", () => {
    const page = src("app/app/tickets/page.tsx");
    expect(page).toContain(".range(");
    expect(page).toContain("ListPager");
    expect(page).toContain("pageParam");
  });

  it("remaining hot queues share the same pager pattern", () => {
    const pages = [
      "app/app/employees/page.tsx",
      "app/app/crm/leads/page.tsx",
      "app/app/crm/deals/page.tsx",
      "app/app/leave/page.tsx",
      "app/app/recruitment/applicants/page.tsx",
      "app/app/client/tickets/page.tsx",
      "app/app/admin/users/page.tsx",
      // The cross-domain action queue. A pending approval past position 50 was
      // invisible with no pager and no indication it existed — on the screen
      // whose whole job is telling someone what is waiting for them.
      "app/app/approvals/page.tsx",
      // Client timesheet review queue, same problem at 40 days.
      "app/app/client/timesheets/page.tsx",
    ];
    for (const path of pages) {
      const page = src(path);
      expect(page, path).toContain(".range(");
      expect(page, path).toContain("ListPager");
      expect(page, path).toContain("pageParam");
    }
  });

  it("the two queues fixed today no longer cap silently", () => {
    // Scoped deliberately. A blanket "no .limit(50) anywhere" assertion fails on
    // `app/app/admin/users/page.tsx`, which caps a *search-candidate* sub-query
    // (ids to match) rather than the rendered list — a legitimate and separate
    // tradeoff. Asserting the whole file would have flagged correct code.
    for (const path of [
      "app/app/approvals/page.tsx",
      "app/app/client/timesheets/page.tsx",
    ]) {
      expect(code(path), path).not.toMatch(/\.limit\((?:40|50)\)/);
    }
  });

  it("the timesheets heading counts every pending day, not just the page", () => {
    // The heading reads "Awaiting your review (n)". Under pagination, n derived
    // from the page's row count would report "20" while 47 days waited.
    const page = src("app/app/client/timesheets/page.tsx");
    expect(page).toContain('count: "exact"');
    expect(page).toContain("pendingReviewTotal");
    expect(page).not.toMatch(/Awaiting your review \(\{pendingReview\.length\}\)/);
  });
});

describe("a page hosting several independent lists", () => {
  const cms = src("app/app/cms/page.tsx");
  const pager = src("components/app/list-pager.tsx");

  it("gives every CMS list its own page key", () => {
    // /app/cms stacks six lists on one page instead of tabbing them. With a
    // single shared `page` param, advancing to the testimonials pager would land
    // on testimonials page 3 because you had paginated FAQs — six independent
    // queues fighting over one URL parameter.
    const params = [...cms.matchAll(/param="([^"]+)"/g)].map((m) => m[1]);
    expect(params).toHaveLength(6);
    expect(new Set(params).size).toBe(6);
    for (const key of params) {
      expect(cms).toContain(`pageParam(params.${key})`);
    }
  });

  it("ranges all six CMS queries rather than capping them", () => {
    expect([...code("app/app/cms/page.tsx").matchAll(/\.range\(/g)]).toHaveLength(6);
    // `.limit(50)` appears only in the explanatory comment, which `code()`
    // strips — the same rule `audit-design-system.mjs` follows.
    expect(code("app/app/cms/page.tsx")).not.toContain(".limit(50)");
  });

  it("ListPager takes the page key as a prop and defaults it", () => {
    expect(pager).toContain("param");
    expect(pager).toMatch(/param = "page"/);
    expect(pager).toContain("qs.set(param, String(page))");
  });

  it("Page {page} label stays readable on a phone", () => {
    // `ListPager` renders a plain <span>, which the responsive auditor inspects.
    // It was `text-sm` (14px) like the rest of the pre-`Card` world.
    expect(pager).toContain("text-base text-slate sm:text-sm");
  });
});

describe("a full last page must not advertise a next one", () => {
  // The defect: `ListPager` shows Next whenever `rowCount >= pageSize`. Callers
  // fed it `rows.length` from a query capped at `.range(from, from + PAGE_SIZE - 1)`,
  // so a page that was exactly full *and* the last one still showed Next, and
  // clicking it landed on an empty table. The fix is at the call sites: fetch
  // PAGE_SIZE + 1 rows and drop the extra one. Once it is dropped, the rendered
  // count can only reach pageSize when a further page genuinely exists.

  it("every ListPager page drops its sentinel row", () => {
    const pages = listPagerPages();
    // A guard against the discovery helper quietly returning nothing and the
    // per-page loop below passing vacuously.
    expect(pages.length).toBeGreaterThan(20);
    for (const path of pages) {
      expect(code(path), path).toContain(".slice(0, PAGE_SIZE)");
    }
  });

  it("no ListPager page still bounds itself at the last displayed row", () => {
    // `.range(from, page * PAGE_SIZE - 1)` returns at most PAGE_SIZE rows, so the
    // pager cannot tell a full last page from a full middle page. The upper bound
    // has to be `page * PAGE_SIZE` (one row past the page) for the slice to mean
    // anything.
    for (const path of listPagerPages()) {
      expect(code(path), path).not.toContain("PAGE_SIZE - 1");
    }
  });

  it("the six CMS lists each fetch a sentinel", () => {
    // /app/cms stacks six independent paginated lists on one page. Fixing five
    // and leaving the sixth on the old range would reintroduce the empty-page
    // bug on exactly one of the six, which is the case nobody tests by hand.
    const cms = code("app/app/cms/page.tsx");
    expect([...cms.matchAll(/\.range\(/g)]).toHaveLength(6);
    expect([...cms.matchAll(/\.slice\(0, PAGE_SIZE\)/g)]).toHaveLength(6);
  });

  it("ListPager's own contract is untouched by the sentinel", () => {
    // None of this works if `showNext` is rewritten to something cleverer, so the
    // whole fix rests on this one line staying as it is.
    const pager = src("components/app/list-pager.tsx");
    expect(pager).toContain("const showNext = rowCount >= pageSize;");
    expect(pager).toMatch(/param = "page"/);
    expect(pager).toContain("qs.set(param, String(page))");
    expect(pager).toContain("text-base text-slate sm:text-sm");
  });
});
