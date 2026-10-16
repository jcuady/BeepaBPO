import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two gates that both PASSED while missing real defects.
 *
 * `audit-suite-base-url.mjs` reported "41 browser-driving scripts agree" and was
 * wrong three ways:
 *
 *   1. It only examined scripts importing Playwright, so `smoke-cron.mjs` — which
 *      uses plain `fetch` — was never looked at, despite the file's own comment
 *      saying the rule covers anything that "drives a browser **or fetches a
 *      page**". The gate enforced half of its stated rule.
 *   2. It only matched the literal source shape `const BASE = ...`, so a
 *      lowercase `const base = ...` was skipped too.
 *   3. It excused any script with no env override, on the reasoning that "a
 *      hardcoded literal cannot drift". That is simply false:
 *      `audit-targets.mjs` and `audit-text-list.mjs` hardcoded port 3000 outright.
 *
 * Fixing all three took the population from 41 to 58 HTTP scripts and surfaced
 * four more genuinely drifted scripts. Every case below is planted.
 *
 * `audit-gate-coverage.mjs` had the mirror-image failure: it scanned only one
 * orchestrator and reported "28 of 35 audits are never run". `verify-all.mjs`
 * invokes most of them. A coverage check with a false gap is worse than none —
 * the reader either ignores it or trusts the number.
 */

const ROOT = process.cwd();
const BASE_URL_GATE = join(ROOT, "scripts", "audit", "audit-suite-base-url.mjs");
const COVERAGE_GATE = join(ROOT, "scripts", "audit", "audit-gate-coverage.mjs");

/**
 * Runs a gate against a fixture tree.
 *
 * `cwd` is the FIXTURE directory, not `ROOT`, and that is load-bearing now that
 * these gates write evidence.
 *
 * The first version passed `cwd: ROOT`, which was invisible while the gates wrote
 * nothing — a fixture run that printed a verdict and exited was self-contained.
 * The moment `audit-suite-base-url.mjs` and `audit-form-reset-defaults.mjs` began
 * writing `docs/evidence/*.json` — which is the whole point of this pass — every
 * planted-bad-input test started OVERWRITING THE REPOSITORY'S REAL EVIDENCE with
 * fixture results: `suite-base-url.json` claiming `httpScripts: 0, verdict:
 * unknown`, `form-reset-defaults.json` claiming `scanned: 1`. Both were committed
 * that way before it was caught, and both would have been read by the matrix as
 * real measurements.
 *
 * `audit-gate-coverage` tests already did this correctly (`cwd: dir`); this one
 * did not. The rule this establishes: a test that runs a gate which writes a
 * committed file MUST run it in a disposable cwd. See also the identical helper
 * in `tests/audit-evidence-coverage.test.ts`.
 */
function runGate(script: string, args: string[], cwd: string = ROOT) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

/** Writes `files` into a throwaway dir, runs the gate over it, cleans up. */
function runOver(files: Record<string, string>, script = BASE_URL_GATE, extra: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "gate-integrity-"));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body, "utf8");
    // cwd = the fixture dir, so any evidence the gate writes is discarded with it.
    return runGate(script, [`--dir=${dir}`, ...extra], dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const FETCHING = 'const r = await fetch("/api/health");\n';

describe("audit-suite-base-url sees the whole population", () => {
  it("is clean on scripts that already agree", () => {
    const r = runOver({
      "good-a.mjs": `const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";\n${FETCHING}`,
      "good-b.mjs": `const base = (process.env.QA_BASE_URL || "http://localhost:3100");\n${FETCHING}`,
    });
    expect(r.out).toContain("every audit script agrees");
    expect(r.status).toBe(0);
  });

  it("catches a fetch-only script that reads the wrong env var", () => {
    // Hole 1: no Playwright import anywhere in this file.
    const r = runOver({
      "cron.mjs": `const base = (process.env.SMOKE_BASE_URL || "http://localhost:3000");\n${FETCHING}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("cron.mjs");
    expect(r.out).toContain("SMOKE_BASE_URL");
    expect(r.out).toContain("QA_BASE_URL");
  });

  it("catches a lowercase, parenthesised base declaration", () => {
    // Hole 2: `const base`, not `const BASE`.
    const r = runOver({
      "lower.mjs": `const base = (process.env.QA_BASE_URL || "http://localhost:3000");\n${FETCHING}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("lower.mjs");
    expect(r.out).toContain("localhost:3000");
  });

  it("catches a hardcoded literal with no env override at all", () => {
    // Hole 3: the case the old gate excused as "cannot drift".
    const r = runOver({
      "hardcoded.mjs": `const origin = "http://localhost:3000";\n${FETCHING}`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("hardcoded.mjs");
  });

  it("counts a drift that lives outside any base-URL declaration", () => {
    // Two literals in one file are one file to fix, not two findings — but the
    // file must still be named, or a two-offender script looks half-scanned.
    const r = runOver({
      "shots.mjs": `await page.goto("http://localhost:3000/");\nawait page.goto("http://localhost:3000/#faq");\n`,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("shots.mjs");
    expect(r.out.match(/references localhost:3000/g) ?? []).toHaveLength(1);
  });

  it("does not mistake a comment or a prose string for a drifted origin", () => {
    // The stripper must be string-aware: a naive `//`-to-end-of-line delete turns
    // `"http://localhost:3000"` into `"http:`, deleting the literal under test.
    const r = runOver({
      "commented.mjs": [
        "// historically this pointed at localhost:3000",
        "/** old default: http://localhost:3000 */",
        `const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";`,
        FETCHING,
      ].join("\n"),
    });
    expect(r.out).toContain("every audit script agrees");
    expect(r.status).toBe(0);
  });

  it("leaves an application constant alone", () => {
    // NEXT_PUBLIC_SITE_URL is a build-time value, not an operator's base URL.
    // Flagging it would be the confident-nonsense finding class.
    const r = runOver({
      "app.mjs": `const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://beepabpo.com";\n${FETCHING}`,
    });
    expect(r.out).toContain("every audit script agrees");
    expect(r.status).toBe(0);
  });

  it("ignores scripts that never perform HTTP", () => {
    const r = runOver({
      "static.mjs": `const BASE = "http://localhost:3000";\nexport const x = BASE;\n`,
    });
    expect(r.out).toContain("every audit script agrees");
    expect(r.status).toBe(0);
  });

  it("aborts rather than reporting agreement on a directory with no scripts", () => {
    // This is the one that put `verdict: "unknown"` into the real
    // `suite-base-url.json`: the abort path writes evidence, and this ran in
    // `ROOT`. Two fixes now apply — the gate writes BESIDE ITS INPUT, and this
    // runs in a disposable cwd — and either alone would have prevented it.
    //
    // The root is an EMPTY directory that exists, not a nonexistent path: the
    // gate creates the directory it writes evidence into, so pointing `--dir` at
    // a path that is not there would contradict the very behaviour under test.
    const dir = mkdtempSync(join(tmpdir(), "gate-abort-"));
    const empty = mkdtempSync(join(tmpdir(), "gate-empty-"));
    try {
      const r = runGate(BASE_URL_GATE, [`--dir=${empty}`], dir);
      expect(r.status).not.toBe(0);
      // And the abort is recorded in the disposable evidence, which is what makes
      // it worth running here rather than just asserting the exit code.
      const written = join(empty, "docs", "evidence", "suite-base-url.json");
      expect(existsSync(written)).toBe(true);
      expect(JSON.parse(readFileSync(written, "utf8")).verdict).toBe("unknown");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("audit-gate-coverage compares both orchestrators", () => {
  const runner = (paths: string[]) =>
    paths.map((p) => `spawnSync("node", ["${p}"], {});`).join("\n");

  /**
   * Builds a throwaway repo-shaped tree and runs the gate with its DEFAULT
   * arguments from inside it — no `--pkg`, no `--runners`.
   *
   * The first draft of this helper passed absolute paths for both, which made one
   * test fail for a reason that had nothing to do with the gate: `verify:all` is
   * declared as `node scripts/verify-all.mjs` and matched against
   * `scripts/verify-all.mjs`, a relative string, so the comparison could never
   * succeed. The gate was right and the fixture was wrong. Running against the
   * real defaults, in a repo-shaped tree, tests the comparison that actually runs.
   */
  function inFakeRepo(pkgScripts: Record<string, string>, runnerText: string) {
    const dir = mkdtempSync(join(tmpdir(), "coverage-"));
    try {
      mkdirSync(join(dir, "scripts", "audit"), { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: pkgScripts }), "utf8");
      writeFileSync(join(dir, "scripts", "audit", "qa-run-all.mjs"), runnerText, "utf8");
      writeFileSync(join(dir, "scripts", "verify-all.mjs"), runnerText, "utf8");
      const r = spawnSync(process.execPath, [COVERAGE_GATE], { cwd: dir, encoding: "utf8" });
      return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("passes when every declared audit is wired into a runner", () => {
    const r = inFakeRepo(
      { "audit:a": "node scripts/a.mjs", "audit:b": "node scripts/b.mjs" },
      runner(["scripts/a.mjs", "scripts/b.mjs"]),
    );
    expect(r.status).toBe(0);
    expect(r.out).toContain("every declared audit script is wired");
  });

  it("fails when a declared audit is invoked by nothing", () => {
    const r = inFakeRepo(
      { "audit:a": "node scripts/a.mjs", "audit:orphan": "node scripts/orphan.mjs" },
      runner(["scripts/a.mjs"]),
    );
    expect(r.status).toBe(1);
    expect(r.out).toContain("audit:orphan");
    expect(r.out).toContain("scripts/orphan.mjs");
  });

  it("finds a gap that only the second orchestrator closes", () => {
    // The false alarm that nearly shipped: scanning qa-run-all alone reported
    // 28 of 35 audits as never run, when verify-all invokes most of them.
    const dir = mkdtempSync(join(tmpdir(), "coverage-"));
    try {
      mkdirSync(join(dir, "scripts", "audit"), { recursive: true });
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ scripts: { "audit:a": "node scripts/a.mjs", "audit:b": "node scripts/b.mjs" } }),
        "utf8",
      );
      // Only verify-all knows about scripts/b.mjs.
      writeFileSync(join(dir, "scripts", "audit", "qa-run-all.mjs"), runner(["scripts/a.mjs"]), "utf8");
      writeFileSync(join(dir, "scripts", "verify-all.mjs"), runner(["scripts/a.mjs", "scripts/b.mjs"]), "utf8");
      const r = spawnSync(process.execPath, [COVERAGE_GATE], { cwd: dir, encoding: "utf8" });
      expect(r.status).toBe(0);
      expect((r.stdout ?? "") + (r.stderr ?? "")).toContain("every declared audit script is wired");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("counts seed, fix and planning scripts as not-gates rather than as gaps", () => {
    // They are not audits. Reporting them as missing coverage fabricates a
    // finding in order to look thorough.
    const r = inFakeRepo(
      { "audit:a": "node scripts/a.mjs", "seed:demo": "node scripts/seed.mjs" },
      runner(["scripts/a.mjs"]),
    );
    expect(r.status).toBe(0);
    expect(r.out).toContain("not gates by nature");
  });

  it("treats a runner as gated by being the gate", () => {
    // `verify:all` points at scripts/verify-all.mjs, which IS one of the runners
    // being scanned. Asking who invokes the release gate is asking who runs it.
    const r = inFakeRepo({ "verify:all": "node scripts/verify-all.mjs" }, runner(["scripts/a.mjs"]));
    expect(r.status).toBe(0);
    expect(r.out).toContain("every declared audit script is wired");
  });

  it("aborts with exit 2 when a named runner does not exist", () => {
    // A missing runner is not an empty runner. Falling back to "0 paths" would
    // report every declared script ungated and read as a real finding.
    const dir = mkdtempSync(join(tmpdir(), "coverage-"));
    try {
      writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { "audit:a": "node scripts/a.mjs" } }), "utf8");
      const r = spawnSync(
        process.execPath,
        [COVERAGE_GATE, `--runners=${join(dir, "nope.mjs")}`],
        { cwd: dir, encoding: "utf8" },
      );
      expect(r.status).toBe(2);
      expect((r.stdout ?? "") + (r.stderr ?? "")).toContain("gate runner not found");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("aborts when package.json has no audit scripts to compare", () => {
    const r = inFakeRepo({ build: "next build" }, runner(["scripts/a.mjs"]));
    expect(r.status).toBe(2);
  });
});

describe("the ship gate's --skip-migration means what it says", () => {
  it("guards a real migration check, and no longer excuses a failed realtime probe", () => {
    const src = readFileSync(join(ROOT, "scripts", "verify-all.mjs"), "utf8");
    // There is a migration step at all now.
    expect(src).toContain("preflight-pending-migrations.mjs");
    // It is what the flag skips.
    expect(src).toMatch(/SKIP_MIGRATION[\s\S]{0,200}?skipped:\s*true/);
    // And the fabricated excuse is gone. That migration is applied; naming it as
    // unapplied turned a broken notification path into a green release.
    expect(src).not.toContain("20261006140000 not pushed yet");
    expect(src).not.toMatch(/DELIVERY_FAILED[\s\S]{0,200}?skipped:\s*true/);
  });
});

/**
 * Evidence older than the build describes a build that is gone.
 *
 * The control-surface census does not discover which pages to walk — it reads
 * `role-sweep.json` and walks whatever that lists. A census written at 06:45 UTC
 * on 2026-10-15 read a role-sweep.json last written 2026-10-13, so its
 * "84.5% of action controls covered" figure was computed over the previous
 * build's pages. Nothing reported it: the census's own header names the failure
 * ("running it first would silently measure the previous run's routes") and then
 * relies on registry ordering to prevent it, which does nothing when the script is
 * run directly — which is how every audit here is normally run.
 *
 * The same class as `audit-server-fresh`, applied to an evidence input rather
 * than to a process.
 */
describe("the control census refuses a stale role list", () => {
  const census = readFileSync(
    join(ROOT, "scripts", "audit", "qa-control-surface-census.mjs"),
    "utf8",
  );

  it("compares the role sweep's age against the build", () => {
    expect(census).toContain('".next/BUILD_ID"');
    expect(census).toMatch(/statSync\(BUILD_ID\)\.mtimeMs/);
    expect(census).toMatch(/statSync\(ROLE_SWEEP\)\.mtimeMs/);
  });

  it("aborts rather than reporting a coverage figure over old pages", () => {
    // Exit 2, not 0 and not 1. There is no defect to fail; there is an input
    // that cannot support the claim being made about it.
    expect(census).toMatch(/sweepAt\s*<\s*builtAt[\s\S]{0,600}?process\.exit\(2\)/);
    // And it must happen BEFORE the browser launches, or the abort costs a
    // full walk of every role before anyone learns the input was unusable.
    expect(census.indexOf("sweepAt < builtAt")).toBeLessThan(census.indexOf("chromium.launch"));
  });

  it("records the age of both inputs in its own evidence", () => {
    // Otherwise a reader has to go and stat the files to tell a fresh rollup
    // from one built on yesterday's routes.
    expect(census).toMatch(/rolesWhen:\s*[^,\n]*statSync\(ROLE_SWEEP\)/);
    expect(census).toMatch(/assertionsWhen:\s*[^,\n]*statSync\(ASSERTION_INDEX\)/);
  });
});