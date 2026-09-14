import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function src(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
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
    ];
    for (const path of pages) {
      const page = src(path);
      expect(page, path).toContain(".range(");
      expect(page, path).toContain("ListPager");
      expect(page, path).toContain("pageParam");
    }
  });
});
