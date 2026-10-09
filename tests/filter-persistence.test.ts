import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Filter-persistence gate.
 *
 * `ListPager` rebuilds its URL from the `query` prop alone (hrefFor() starts
 * from an empty URLSearchParams). So a filter the page renders in its FilterBar
 * but does not name in `query` does not survive a page change. The user clicks
 * Next, the role filter vanishes, and the list widens to a population they never
 * asked for — with no error and no empty state to signal it.
 *
 * That is not hypothetical: /app/admin/users shipped `query={{ q }}` while
 * reading `stringParam(params.role)`, so page two of a role-filtered admin list
 * was an unfiltered one.
 *
 * An auditor that cannot fail is worse than none, because it gets trusted. The
 * first half of this file runs the real script against fixtures that each break
 * exactly one rule and asserts it *fails*.
 *
 * The first version of this auditor was itself the bug it hunts: it read only
 * keyed object entries, so all 14 shorthand `{ q, status }` pages looked
 * broken, and it could not resolve `query={filterQuery}`, so it accused
 * attendance of dropping four filters. Both are negative controls here, because
 * both shipped once.
 */

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "audit-filter-persistence.mjs");

function runAudit(appDir: string) {
  const r = spawnSync(process.execPath, [SCRIPT, appDir], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

/** Write page files into a throwaway app/ tree and audit them. */
function auditFixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "filter-audit-"));
  try {
    const app = join(dir, "app");
    mkdirSync(app, { recursive: true });
    for (const [rel, body] of Object.entries(files)) {
      const full = join(app, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, body, "utf8");
    }
    return runAudit(app);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A page carrying every filter it reads. `page` is the pager's own key. */
const CLEAN = {
  "app/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const q = stringParam(params.q);
  const role = stringParam(params.role);
  const page = pageParam(params.page);
  return <ListPager page={page} pageSize={25} rowCount={25} query={{ q, role }} />;
}`,
};

describe("filter-persistence auditor — negative controls", () => {
  it("passes a page whose pager carries both filters", () => {
    const r = auditFixture(CLEAN);
    expect(r.status).toBe(0);
    expect(r.out).toContain("PASS");
  });

  it("FAILS a filter read but not carried into the pager", () => {
    // The exact shipped defect on /app/admin/users.
    const r = auditFixture({
      "app/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const q = stringParam(params.q);
  const role = stringParam(params.role);
  return <ListPager page={1} pageSize={25} rowCount={25} query={{ q }} />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL");
    // It must name the *dropped* filter, not merely fail.
    expect(r.out).toMatch(/reads: role/);
  });

  it("understands shorthand object properties", () => {
    // Regression control for the first version of this script, which matched
    // only `key: value` and so flagged every `{ q, status }` page.
    const r = auditFixture({
      "app/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const q = stringParam(params.q);
  const status = stringParam(params.status);
  return <ListPager page={1} pageSize={25} rowCount={25} query={{ q, status }} />;
}`,
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain("PASS");
  });

  it("resolves query={identifier} built above the JSX", () => {
    // Regression control for the second version, which could only read inline
    // literals and therefore accused /app/attendance of dropping q, status,
    // week and heatmap. That page passes filterQuery and always has.
    const r = auditFixture({
      "app/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const q = stringParam(params.q);
  const week = weekStartParam(params.week);
  const filterQuery = {
    q,
    status: status === "all" ? undefined : status,
    week,
  };
  return <ListPager page={1} pageSize={25} rowCount={25} query={filterQuery} />;
}`,
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain("PASS");
  });

  it("catches a drop hidden behind a variable query object", () => {
    // Proves the identifier resolution is not just permissive.
    const r = auditFixture({
      "app/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const q = stringParam(params.q);
  const role = stringParam(params.role);
  const filterQuery = { q, status: undefined };
  return <ListPager page={1} pageSize={25} rowCount={25} query={filterQuery} />;
}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/reads: role/);
  });

  it("reports an unresolvable query instead of accusing the page", () => {
    // A scanner gap is not a bug in the code under test. The auditor says so
    // rather than inventing a violation it cannot substantiate.
    const r = auditFixture({
      "app/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const q = stringParam(params.q);
  return <ListPager page={1} pageSize={25} rowCount={25} query={buildIt(q)} />;
}`,
    });
    expect(r.status).toBe(0);
    // The note must name the expression it could not read, or it is not much
    // better than a shrug.
    expect(r.out).toContain("NOTE");
    expect(r.out).toContain("query={buildIt(q)}");
    expect(r.out).not.toContain("FAIL");
  });

  it("ignores pages with no pager, and ignores pageParam", () => {
    // `page` is the pager's own key, not a filter it has to carry.
    const r = auditFixture({
      "app/detail/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const id = stringParam(params.id);
  return <div>{id}</div>;
}`,
      "app/list/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const q = stringParam(params.q);
  const page = pageParam(params.page);
  return <ListPager page={page} pageSize={25} rowCount={25} query={{ q }} />;
}`,
    });
    expect(r.status).toBe(0);
  });

  it("does not read filters out of comments", () => {
    // These pages document their own fixes in comments, including the literal
    // text `stringParam(params.role)`. Counting those would invent violations.
    const r = auditFixture({
      "app/page.tsx": `export default async function P({ searchParams }) {
  const params = await searchParams;
  const q = stringParam(params.q);
  // Previously: query={{ q }} dropped stringParam(params.role) entirely.
  /* Block comment mentioning stringParam(params.status). */
  return <ListPager page={1} pageSize={25} rowCount={25} query={{ q }} />;
}`,
    });
    expect(r.status).toBe(0);
  });

  it("rejects a non-directory argument loudly", () => {
    // Regression control for the argv lesson: a bad path must not be read as
    // data. Exit 2, not a verdict.
    const r = spawnSync(process.execPath, [SCRIPT, "definitely-not-here"], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect((r.stdout ?? "") + (r.stderr ?? "")).not.toContain("PASS");
  });
});

describe("filter-persistence auditor — live repo", () => {
  it("every paginated page in app/ carries its filters", () => {
    const r = runAudit(join(ROOT, "app"));
    expect(r.out).not.toContain("NOTE");
    expect(r.out).not.toContain("could not be resolved");
    expect(r.status).toBe(0);
    // Guard against a silent no-op: the scan must actually have found pages.
    const scanned = Number(r.out.match(/scanned (\d+) page/)?.[1] ?? 0);
    expect(scanned).toBeGreaterThan(20);
  });
});

describe("/app/admin/users role filter", () => {
  /**
   * Comments removed before asserting on this page's source.
   *
   * These pages document their own fixes inline, so the prose names the very
   * identifiers under test: the admin page explains that it does *not* reuse
   * the invite form's `ROLE_OPTIONS`, and the membership_roles query carries a
   * comment explaining its own `.limit()`. A naive `not.toContain` fails on the
   * explanation of the fix — the same trap `audit-design-system.mjs` and
   * `tests/list-pagination.test.ts` already handle by stripping first.
   */
  function adminUsersCode() {
    return readFileSync(join(ROOT, "app/app/admin/users/page.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  }

  it("reads roles from the database rather than the invite form's subset", () => {
    // `admin-invite-form.tsx` has a ROLE_OPTIONS list that deliberately omits
    // Owner and Super Admin. Reusing it would make "who is an Owner?"
    // unanswerable — the question this filter exists to answer.
    const page = adminUsersCode();
    expect(page).toContain('from("roles")');
    expect(page).not.toContain("ROLE_OPTIONS");
  });

  it("carries the role filter across pagination", () => {
    expect(adminUsersCode()).toMatch(/query=\{\{[^}]*role[^}]*\}\}/);
  });

  it("bounds the role id list it inlines into the query", () => {
    // These ids go into a PostgREST `.in()` filter, i.e. into a URL, which has
    // a length ceiling. The adjacent text-filter sub-queries are capped at 100
    // and 50; an uncapped role list was the one unbounded query on the page.
    const page = adminUsersCode();
    const block = page.slice(page.indexOf('from("membership_roles")'));
    expect(block.slice(0, 200)).toMatch(/\.limit\(\d+\)/);
  });
});