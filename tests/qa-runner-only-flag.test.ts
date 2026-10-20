import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The suite runner could not be run in pieces.
 *
 * `qa-run-all.mjs --all` runs 33 checks in registry order and does not finish
 * inside a CI step or a harness timeout. On 2026-10-20 it was cut off after
 * **22 of 33**, and the eleven it never reached were the slow tail
 * (`role-sweep`, `control-census`, `role-pages`, `performance`) plus the last
 * two fast-tier gates. The checks with the least evidence behind them were the
 * ones that never ran — and the run still wrote a rollup, which read like a
 * whole-suite rollup.
 *
 * `--only=<ids>` runs exactly those checks. It exists so the tail is
 * reachable.
 *
 * The failure mode worth guarding is a typo. `--only=role-sweep,contol-census`
 * names an id that does not exist; a naive filter would select one check and
 * quietly skip the other, which is the same class as a check that cannot fail.
 * An unknown id is therefore an error with exit code 2, and it names the id.
 *
 * **This test brings its own server.** The runner probes `$QA_BASE_URL/api/health`
 * before every check and SKIPS the check if the server does not answer — which is
 * how a dead server stops being scored as a product failure. The first version of
 * this test pointed at the default `http://localhost:3100` and passed only when
 * an app server happened to be running. The ship gate caught it: its vitest step
 * runs with no server up, so the runner skipped the check and exited 2, and the
 * test failed there and passed everywhere else. A unit test must not inherit the
 * environment dependency of the thing it exercises.
 *
 * Every test here also runs with a DISPOSABLE cwd. The runner writes
 * `docs/evidence/qa-suite.json`, and the check it runs writes its own evidence
 * file — running this against the repository root would overwrite the real
 * measurements with fixture results, which is the exact hazard recorded in
 * `docs/REMAINING_WORK.md` §2.9a.
 */

const ROOT = process.cwd();
const RUNNER = join(ROOT, "scripts", "audit", "qa-run-all.mjs");

/** A stand-in for the app server: answers the health probe, nothing else. */
function startHealthServer(): Promise<{ url: string; close: () => void }> {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}

/** A temp tree containing a stub for one check, so nothing real is executed. */
function makeFixture(checkScript: string, evidencePath: string) {
  const dir = mkdtempSync(join(tmpdir(), "qa-only-"));
  const scriptDir = join(dir, "scripts", "audit");
  mkdirSync(scriptDir, { recursive: true });
  writeFileSync(
    join(scriptDir, checkScript),
    [
      'import { mkdirSync, writeFileSync } from "node:fs";',
      'mkdirSync("docs/evidence", { recursive: true });',
      `writeFileSync(${JSON.stringify(evidencePath)}, JSON.stringify({ check: "stub", verdict: "agree" }) + "\\n");`,
      'console.log("stub check ran");',
    ].join("\n"),
    "utf8",
  );
  return dir;
}

/**
 * Runs the runner ASYNCHRONOUSLY.
 *
 * `spawnSync` would block this process's event loop, so the in-process health
 * server could never answer the runner's `/api/health` probe — the runner would
 * conclude the server was down, skip the check and exit 2. That is the same
 * failure as before, wearing a different hat.
 */
function runRunner(
  args: string[],
  cwd: string,
  baseUrl: string,
): Promise<{ status: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, ...args], {
      cwd,
      env: { ...process.env, QA_BASE_URL: baseUrl },
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (status) => resolve({ status, out }));
  });
}

describe("the suite runner can be run in pieces", () => {
  it("rejects an unknown check id instead of running a smaller set", async () => {
    const server = await startHealthServer();
    const dir = mkdtempSync(join(tmpdir(), "qa-only-"));
    try {
      const r = await runRunner(["--only=role-sweep,contol-census"], dir, server.url);
      expect(r.status).toBe(2);
      expect(r.out).toContain("contol-census");
      // It must also list the ids that DO exist, so the reader can fix the
      // command instead of guessing.
      expect(r.out).toContain("role-sweep");
      // A rejected invocation must leave no rollup behind: a file written by a
      // run that did not happen is a file that describes a run that did not
      // happen.
      expect(existsSync(join(dir, "docs", "evidence", "qa-suite.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      server.close();
    }
  }, 30_000);

  it("runs exactly the requested check and says the run was partial", async () => {
    const server = await startHealthServer();
    const dir = makeFixture("audit-suite-base-url.mjs", "docs/evidence/suite-base-url.json");
    try {
      const r = await runRunner(["--only=suite-base-url"], dir, server.url);
      expect(r.status).toBe(0);

      const rollup = JSON.parse(
        readFileSync(join(dir, "docs", "evidence", "qa-suite.json"), "utf8"),
      );
      expect(rollup.idsRun).toEqual(["suite-base-url"]);
      expect(rollup.total).toBe(1);
      expect(rollup.passed).toBe(1);
      // The whole point of recording it: a partial run must not be readable as
      // a whole one.
      expect(rollup.wholeRegistry).toBe(false);
      expect(rollup.tiersRun).toEqual(["fast"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      server.close();
    }
  }, 30_000);

  it("leaves the repository's own evidence untouched", async () => {
    const server = await startHealthServer();
    const dir = makeFixture("audit-suite-base-url.mjs", "docs/evidence/suite-base-url.json");
    const real = join(ROOT, "docs", "evidence", "suite-base-url.json");
    const before = readFileSync(real, "utf8");
    try {
      await runRunner(["--only=suite-base-url"], dir, server.url);
      expect(readFileSync(real, "utf8")).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      server.close();
    }
  }, 30_000);
});
