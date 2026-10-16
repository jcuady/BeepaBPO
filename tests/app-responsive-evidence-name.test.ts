import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// `audit-app-responsive.mjs` writes its evidence file with a name derived from
// the routes. Two defects lived in that one line, and both are invisible until
// the script is run the way row 21c needs it run — directly, with no
// QA_CHUNK_LABEL and the full default route list:
//
//   1. The derived name overran Windows' 260-char MAX_PATH. The sweep printed
//      `56/56 viewport-route combinations clean`, then `writeFileSync` threw
//      ENOENT and the process exited 1. It reported success and could not record
//      that it had succeeded.
//   2. The name omitted the account, so a second role measured over the same
//      routes produced the identical filename and silently overwrote the first
//      role's evidence — which would have destroyed seven of the eight files
//      the per-role re-run exists to produce.
//
// The slug is built inline in the script, so these assert the source shape and
// then rebuild the slug here with the same recipe. A future rewrite has to
// update this test, which is the point: the failure was never visible from
// reading the code.

const SCRIPT = "scripts/audit-app-responsive.mjs";
const src = readFileSync(SCRIPT, "utf8");

/** The 28 default routes, as the script's ROUTES constant defines them. */
const DEFAULT_ROUTES = [
  "/app/dashboard", "/app/my", "/app/my/attendance", "/app/my/leave",
  "/app/my/payroll", "/app/my/requests", "/app/my/documents", "/app/my/schedule",
  "/app/crm", "/app/crm/leads", "/app/crm/deals", "/app/crm/proposals",
  "/app/attendance", "/app/leave", "/app/employees", "/app/payroll",
  "/app/payroll/periods", "/app/billing", "/app/recruitment",
  "/app/recruitment/jobs", "/app/recruitment/applicants", "/app/tickets",
  "/app/approvals", "/app/reports", "/app/hr", "/app/admin",
  "/app/admin/users", "/app/clients",
];

const MAX_SLUG = 80;

/** Mirrors the slug recipe in the script under test. */
function buildSlug(email: string, routes: string[], chunkLabel?: string) {
  const routeSlug = routes
    .map((r) => r.replace(/^\//, "").replace(/[/?=&]/g, "_") || "root")
    .join("_");
  const digest = createHash("sha256").update(routeSlug).digest("hex").slice(0, 8);
  const accountSlug = email.split("@")[0].replace(/[^a-z0-9_-]/gi, "");
  if (chunkLabel) return chunkLabel;
  return `${accountSlug}-${routeSlug.slice(0, MAX_SLUG - accountSlug.length - digest.length - 2)}-${digest}`;
}

describe("audit-app-responsive evidence filename", () => {
  it("keeps the whole evidence path inside Windows MAX_PATH", () => {
    // 260 is the classic limit. The repo prefix is long on this machine, which
    // is exactly why the derived name overflowed.
    const repo = "C:\\Users\\jcuad\\OneDrive\\Documents\\BeepoBeepa";
    const path = `${repo}\\docs\\evidence\\responsive-app-${buildSlug("owner@demo.beepabpo.com", DEFAULT_ROUTES)}.json`;
    expect(path.length).toBeLessThan(260);
  });

  it("the OLD routes-only recipe overflowed MAX_PATH — the defect this pins", () => {
    const oldRouteSlug = DEFAULT_ROUTES
      .map((r) => r.replace(/^\//, "").replace(/[/?=&]/g, "_") || "root")
      .join("_");
    const repo = "C:\\Users\\jcuad\\OneDrive\\Documents\\BeepoBeepa";
    const oldPath = `${repo}\\docs\\evidence\\responsive-app-${oldRouteSlug}.json`;
    expect(oldPath.length).toBeGreaterThan(260);
    expect(buildSlug("owner@demo.beepabpo.com", DEFAULT_ROUTES).length).toBeLessThanOrEqual(MAX_SLUG);
  });

  it("gives different roles different filenames over the same routes", () => {
    const roles = [
      "owner@demo.beepabpo.com",
      "finance@demo.beepabpo.com",
      "teamlead@demo.beepabpo.com",
      "employee@demo.beepabpo.com",
      "clientadmin@demo.beepabpo.com",
      "clientviewer@demo.beepabpo.com",
      "applicant@demo.beepabpo.com",
    ];
    const names = roles.map((r) => buildSlug(r, DEFAULT_ROUTES));
    expect(new Set(names).size).toBe(roles.length);
    // Each name must be attributable to the role that produced it, and must be
    // a legal filename: `@` and `:` are illegal on Windows and would make the
    // write fail for a third reason.
    for (const [i, n] of names.entries()) {
      expect(n.startsWith(roles[i].split("@")[0])).toBe(true);
      expect(n).not.toMatch(/[@:<>*?"|]/);
    }
  });

  it("gives different route sets different filenames for the same role", () => {
    const a = buildSlug("owner@demo.beepabpo.com", DEFAULT_ROUTES);
    const b = buildSlug("owner@demo.beepabpo.com", DEFAULT_ROUTES.slice(0, 10));
    expect(a).not.toBe(b);
  });

  it("does not truncate two long route sets into the same name", () => {
    // The cap makes collisions possible in principle; the digest is what
    // prevents them. Swap the tail of the route list so the first 80-odd chars
    // are identical — a truncation-only scheme would collide here.
    const a = [...DEFAULT_ROUTES.slice(0, 5), "/app/aaa", "/app/bbb"];
    const b = [...DEFAULT_ROUTES.slice(0, 5), "/app/ccc", "/app/ddd"];
    expect(buildSlug("owner@demo.beepabpo.com", a)).not.toBe(
      buildSlug("owner@demo.beepabpo.com", b),
    );
  });

  it("still honours QA_CHUNK_LABEL, which is how the runner names its chunks", () => {
    // The runner's evidence paths are registered in advance; renaming them
    // would break the registry's "a green check with no evidence file is a
    // finding" rule in the other direction.
    expect(buildSlug("owner@demo.beepabpo.com", DEFAULT_ROUTES, "chunk1")).toBe("chunk1");
    expect(src).toContain("process.env.QA_CHUNK_LABEL");
  });

  it("guards the budget at runtime rather than trusting the arithmetic", () => {
    expect(src).toContain("MAX_PATH will reject the write");
    expect(src).toMatch(/if \(slug\.length > MAX_SLUG/);
  });
});
