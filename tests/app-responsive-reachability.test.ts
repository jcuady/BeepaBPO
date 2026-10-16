import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// `audit-app-responsive.mjs` ships one default route list, built for the owner,
// and is also the tool behind matrix row 21c — responsive measured *per role*.
// Those two uses conflict, because Next's `forbidden()` renders AT the requested
// URL: a role that cannot open `/app/crm` was scored `DENIED forbidden` at every
// viewport, two FAILs per route, none of them about layout.
//
// The script's own comment on `/app/cms` describes this exact failure and fixes
// it by hand for one route, which cannot generalise to a role missing twenty.
// The fix is a reachability pre-pass. These assertions pin the rule and — more
// importantly — pin that the exclusions are *reported* rather than discarded,
// because a filter that hides routes is one line away from hiding regressions.

const src = readFileSync("scripts/audit-app-responsive.mjs", "utf8");

describe("audit-app-responsive per-role reachability", () => {
  it("probes reachability before sweeping when no routes are named", () => {
    expect(src).toMatch(/if \(!ROUTES\.length\)/);
    // The pre-pass must come before the sweep loop.
    expect(src.indexOf("Reachability:")).toBeLessThan(src.indexOf("for (const route of sweepRoutes)"));
  });

  it("treats a denial as 'skip this route', not as a layout FAIL", () => {
    expect(src).toContain("inaccessible.push({ route, status:");
    expect(src).toMatch(/const denied =\s*\n?\s*status === "forbidden"/);
  });

  it("still REPORTS the routes it skipped", () => {
    // A filter that silently drops routes would turn a partial sweep into a
    // clean-looking one. The denials must be printed and written to evidence.
    expect(src).toContain("not reachable by this role");
    expect(src).toContain("requestedRoutes: routes,");
    expect(src).toContain("inaccessible,");
  });

  it("states the denominator, so N/N is not read as full coverage", () => {
    expect(src).toContain("this role can open");
  });

  it("never filters routes the caller named explicitly", () => {
    // Naming a route is an explicit request to measure it. An inaccessible one
    // must still be reported, not quietly dropped — this is the guard against
    // the filter becoming a way to hide a real regression.
    const prePass = src.slice(src.indexOf("const inaccessible = []"), src.indexOf("for (const route of sweepRoutes)"));
    expect(prePass).toContain("if (!ROUTES.length)");
  });

  it("refuses to report 0/0 as a pass", () => {
    // A role that can open nothing is a broken measurement, not a perfect one.
    expect(src).toContain("Refusing to report 0/0 as a pass");
    expect(src).toMatch(/process\.exit\(2\)/);
  });

  it("leaves the runner's chunked path untouched", () => {
    // Every runner entry passes explicit routes, so sweepRoutes === routes and
    // the five registered chunk evidence filenames must not change.
    expect(src).toContain("let sweepRoutes = routes;");
    expect(src).toContain("process.env.QA_CHUNK_LABEL");
  });
});

/**
 * Which routes a segment is even offered.
 *
 * The 28-route default list is the INTERNAL segment's. Client and applicant
 * accounts land on `/app/client` and `/app/applicant` (`lib/auth/landing.ts`),
 * which that list does not contain a single member of — so a client account
 * measured 0/28 reachable, and three of the seven roles on matrix row 21c could
 * not be measured at all. The reachability guard caught it by refusing to
 * report `0/0` as clean, which is the only reason it surfaced at all.
 */
describe("audit-app-responsive segment route pools", () => {
  it("offers client accounts their own routes", () => {
    expect(src).toContain("const CLIENT_ROUTES = [");
    expect(src).toContain('"/app/client"');
    expect(src).toContain('"/app/client/timesheets"');
  });

  it("offers applicant accounts their own routes", () => {
    expect(src).toContain("const APPLICANT_ROUTES = [");
    expect(src).toContain('"/app/applicant"');
    expect(src).toContain('"/app/applicant/profile"');
  });

  it("does not put an internal route in a client pool, or the reverse", () => {
    const clientBlock = src.slice(src.indexOf("const CLIENT_ROUTES"), src.indexOf("const APPLICANT_ROUTES"));
    expect(clientBlock).not.toContain('"/app/payroll"');
    expect(clientBlock).not.toContain('"/app/admin');
    const applicantBlock = src.slice(src.indexOf("const APPLICANT_ROUTES"), src.indexOf("const routes ="));
    expect(applicantBlock).not.toContain('"/app/client');
  });

  it("omits dynamic [id] routes, which need a real record", () => {
    // Record-level pages are covered by the internal-links exercise, which
    // resolves ids from the database rather than guessing one.
    for (const block of ["const CLIENT_ROUTES", "const APPLICANT_ROUTES"]) {
      const body = src.slice(src.indexOf(block), src.indexOf("]", src.indexOf(block)));
      expect(body).not.toContain("[id]");
    }
  });

  it("separates applicant from client, which the old regex conflated", () => {
    // `/client|applicant/.test(EMAIL)` treated both as one segment, so there
    // was no way to offer an applicant the applicant pages.
    expect(src).toContain("const IS_APPLICANT_SEGMENT = /applicant/.test(EMAIL);");
    expect(src).toContain("const IS_CLIENT_SEGMENT = /client/.test(EMAIL);");
  });

  it("uses /login for BOTH client and applicant, /employee/login only for staff", () => {
    // The regression this file exists to prevent: splitting the combined regex
    // in two to get separate route pools silently moved the login page too, and
    // the applicant run navigated to `/employee/login` and timed out waiting
    // for `/app`. Two questions — which login page, which route pool — and the
    // second one must not decide the first.
    expect(src).toContain("const IS_EXTERNAL_SEGMENT = /client|applicant/.test(EMAIL);");
    expect(src).toContain(
      'const loginPath = IS_EXTERNAL_SEGMENT ? "/login" : "/employee/login";',
    );
    expect(src).toContain(
      "name: IS_EXTERNAL_SEGMENT ? /sign in/i : /access portal/i",
    );
    // The login path must not be driven by the route-pool constant.
    expect(src).not.toContain(
      'const loginPath = IS_CLIENT_SEGMENT ? "/login" : "/employee/login";',
    );
  });

  it("still lets explicitly named routes override the pool", () => {
    expect(src).toMatch(/const routes = ROUTES\.length\s*\n?\s*\? ROUTES/);
  });

  it("tests applicant BEFORE client, or the applicant falls through to /app/*", () => {
    // `applicant@…` does not match `/client/`, so a client-first chain measures
    // the applicant against the 28 internal routes — the run that produced this
    // finding reported "Reachability: 0/28" and exited 2, which is the guard
    // working, but it is the wrong question. The applicant pool has 4 routes.
    const block = src.slice(
      src.indexOf("const routes = ROUTES.length"),
      src.indexOf(";", src.indexOf("const routes = ROUTES.length")),
    );
    expect(block.indexOf("IS_APPLICANT_SEGMENT")).toBeLessThan(
      block.indexOf("IS_CLIENT_SEGMENT"),
    );
    expect(block).toContain("APPLICANT_ROUTES");
    expect(block).toContain("CLIENT_ROUTES");
    expect(block).toContain("DEFAULT_ROUTES");
  });
});
