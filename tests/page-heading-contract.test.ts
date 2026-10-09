import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every app page rendered `<h1>Good morning, Demo.</h1>`.
 *
 * `PageHeader` falls back to a time-of-day greeting when no `title` is passed.
 * `SYSTEM_AUDIT.md` §16.5 spotted this on the job detail page, added the `title`
 * prop, and fixed that one caller — while explicitly noting "every existing
 * caller is unaffected". Measured against a73f55a, 79 call sites existed and only
 * that 1 carried a title, so the other 78 rendered a greeting. Because every seeded
 * demo profile has `first_name = "Demo"`, all 78 rendered the byte-identical
 * string "Good morning, Demo.". 76 were given titles; 2 are documented exceptions.
 *
 * An H1 has to identify the page for a screen-reader user arriving by a link, a
 * search, or a bookmark. A greeting identifies the user, not the page, and here
 * not even that.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * The two pages whose subject genuinely IS the signed-in user, where the
 * greeting is the design intent. Both also render a quote, and removing the
 * greeting would cost more than the H1 gains.
 */
const ALLOWED_GREETING = new Set(["app/app/my/page.tsx", "app/app/client/page.tsx"]);

/**
 * Scan BOTH `app/` and `lib/`.
 *
 * The first version of this guard scanned `app/` only, and therefore passed —
 * while `lib/app/admin-pages.tsx` carried eight more untitled call sites. That
 * file renders the shared bodies for /app/dashboard, /app/payroll, /app/hr,
 * /app/recruitment, /app/crm, /app/clients, /app/reports and /app/admin, none of
 * which contain a literal `<PageHeader` of their own. Found by driving a browser
 * and reading the rendered H1, which is the only way a static scan of the wrong
 * directory would have surfaced.
 */
const SCAN_ROOTS = ["app", "lib"];

const offenders: Array<{ file: string; reason: string }> = [];
const total = { callSites: 0 };

for (const root of SCAN_ROOTS) {
  for (const file of walk(join(process.cwd(), root))) {
    const rel = file.replace(/\\/g, "/").split(`/${root}/`).slice(-1)[0];
    const src = readFileSync(file, "utf8");
    const re = /<PageHeader\b([\s\S]*?)(?:\/>|>)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      total.callSites += 1;
      if (!/\btitle=/.test(m[1]) && !ALLOWED_GREETING.has(`${root}/${rel}`)) {
        offenders.push({ file: `${root}/${rel}`, reason: "PageHeader without title" });
      }
    }
  }
}

describe("page headings identify the page", () => {
  it("every PageHeader renders a subject, not a greeting", () => {
    expect(offenders).toEqual([]);
  });

  it("actually found the call sites (guards against a vacuous pass)", () => {
    // If the scanner silently stopped matching, `offenders` would be empty and
    // the test above would pass while checking nothing.
    expect(total.callSites).toBeGreaterThan(60);
  });

  it("covers lib/ as well as app/", () => {
    // `lib/app/admin-pages.tsx` alone contributes eight call sites; a guard that
    // only scanned `app/` passed while eight pages still greeted.
    const src = readFileSync(join(process.cwd(), "lib/app/admin-pages.tsx"), "utf8");
    expect(src).toContain("<PageHeader");
    expect(src).not.toMatch(/<PageHeader\b(?![^>]*title=)/);
  });

  it("keeps the documented exceptions to exactly two", () => {
    // Each exception is a maintenance decision; adding one must be deliberate.
    expect(ALLOWED_GREETING.size).toBe(2);
    for (const f of ALLOWED_GREETING) {
      expect(readFileSync(join(process.cwd(), f), "utf8")).toContain("<PageHeader");
    }
  });
});

describe("negative control", () => {
  it("detects a PageHeader that has reverted to the greeting", () => {
    const withTitle = `<PageHeader title="Leave Approvals" name={name} />`;
    const withoutTitle = `<PageHeader name={name} />`;
    const isOffender = (src: string) => !/\btitle=/.test(src);
    expect(isOffender(withTitle)).toBe(false);
    expect(isOffender(withoutTitle)).toBe(true);
  });
});