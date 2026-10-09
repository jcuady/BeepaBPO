import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  activeNavHref,
  adminNavGroups,
  applicantNav,
  clientNav,
  employeeNav,
} from "../lib/app/navigation";

describe("sidebar active tab", () => {
  const admin = ["/app/admin", "/app/admin/users", "/app/admin/audit"];
  const crm = ["/app/crm", "/app/crm/leads", "/app/crm/deals"];
  const payroll = ["/app/payroll", "/app/payroll/settings"];
  const mine = ["/app/my", "/app/my/attendance", "/app/my/payroll"];

  it("keeps a single tab when a child route is open", () => {
    expect(activeNavHref("/app/admin/users", admin)).toBe("/app/admin/users");
    expect(activeNavHref("/app/crm/leads/abc", crm)).toBe("/app/crm/leads");
    expect(activeNavHref("/app/hr/nte", ["/app/hr", "/app/hr/nte"])).toBe(
      "/app/hr/nte",
    );
    expect(activeNavHref("/app/tickets/sla", ["/app/tickets", "/app/tickets/sla"])).toBe(
      "/app/tickets/sla",
    );
    expect(activeNavHref("/app/payroll/settings", payroll)).toBe(
      "/app/payroll/settings",
    );
  });

  it("highlights the hub only on the hub path", () => {
    expect(activeNavHref("/app/my", mine)).toBe("/app/my");
    expect(activeNavHref("/app/my/attendance", mine)).toBe("/app/my/attendance");
    expect(activeNavHref("/app/payroll", payroll)).toBe("/app/payroll");
    expect(activeNavHref("/app/payroll/periods/1", payroll)).toBe("/app/payroll");
  });

  it("does not light a parent and a child together", () => {
    const pathname = "/app/admin/users";
    const naive = admin.filter(
      (href) => pathname === href || pathname.startsWith(href),
    );
    expect(naive.length).toBeGreaterThan(1);
    expect(admin.filter((href) => href === activeNavHref(pathname, admin))).toEqual([
      "/app/admin/users",
    ]);
  });

  it("gives every role nav item its own page", () => {
    const hrefs = [
      ...employeeNav,
      ...clientNav,
      ...applicantNav,
      ...adminNavGroups.flatMap((group) => group.items),
    ].map((item) => item.href);
    const missing = [...new Set(hrefs)].filter((href) => {
      const file = join(process.cwd(), "app", ...href.split("/").filter(Boolean), "page.tsx");
      return !existsSync(file);
    });
    expect(missing).toEqual([]);
  });

  it("scales linearly and still finds a match at the end of a long nav", () => {
    // This previously asserted wall-clock milliseconds on a pure string
    // function, which measured the machine rather than the code: it failed
    // whenever the box was busy and passed on an idle one. Comparing the cost
    // of two input sizes cancels out both per-call overhead and CPU
    // contention, because contention inflates both samples roughly equally,
    // while an accidental O(n^2) inflates only the large one.
    const build = (count: number) => {
      const hrefs = Array.from({ length: count }, (_, i) => `/app/section/${i}`);
      hrefs.push("/app/payroll/settings");
      return hrefs;
    };

    const small = build(20);
    const large = build(4000);

    // Correctness must hold at scale, with the match last in the list.
    expect(activeNavHref("/app/payroll/settings", large)).toBe("/app/payroll/settings");

    const time = (hrefs: string[], runs: number) => {
      const start = performance.now();
      for (let i = 0; i < runs; i += 1) {
        activeNavHref("/app/payroll/settings", hrefs);
      }
      return performance.now() - start;
    };

    // Warm up so JIT compilation is not attributed to the small sample.
    time(small, 200);
    time(large, 200);

    // 500 runs per sample. This used to be 2000, which made the test a load
    // detector: under `verify-all.mjs` (where `next build` runs 15 workers
    // alongside the suite) 2000 x 4001 string comparisons exceeded vitest's
    // 5s default timeout and failed as a "timeout", not as a scaling problem.
    // 500 still gives a sample well clear of timer resolution while keeping the
    // absolute cost small enough to survive contention.
    const RUNS = 500;
    const smallMs = Math.max(time(small, RUNS), 0.05);
    const largeMs = Math.max(time(large, RUNS), 0.05);

    // 200x more items must cost far more than 200x the time. Linear gives ~200,
    // quadratic ~40000. 20x leaves ample headroom for a busy machine.
    expect(largeMs / smallMs).toBeLessThan(20 * 20);
  }, 30_000);
});
