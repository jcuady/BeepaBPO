import { readFileSync } from "node:fs";
import { join } from "node:path";
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
