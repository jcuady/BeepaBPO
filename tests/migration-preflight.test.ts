import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pending-migration preflight contract.
 *
 * Four migrations have never been executed, because applying them needs
 * credentials this machine does not have. The preflight is the only check that
 * can run in the meantime, so it is worth being precise about what it can
 * honestly assert — which is very little.
 *
 * The first version of this script tried to resolve `public.x` identifiers and
 * produced 80 findings in one run, every one of them wrong: `on delete cascade`
 * read as an object named `delete`, `public.numeric` as a schema object,
 * `from generate_series(...) ea` as a table named `ea`. It also had its pending
 * list inverted and reported 30 long-applied migrations as pending.
 *
 * Both failures are pinned here. The second one is the more interesting: a gate
 * that is confidently wrong gets switched off, and then gets believed when it
 * is accidentally right.
 */

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "audit", "preflight-pending-migrations.mjs");

function run(files: Record<string, string>, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "mig-preflight-"));
  try {
    for (const [name, body] of Object.entries(files)) {
      // Create the PARENT of the file, not the file itself. The first version
      // did mkdirSync(join(dir, name)), which made a directory called `a.sql`
      // and then failed to write into it — so every case errored out identically
      // and the suite proved nothing about the script it was testing.
      const parent = dirname(join(dir, name));
      mkdirSync(parent, { recursive: true });
      writeFileSync(join(dir, name), body, "utf8");
    }
    const r = spawnSync(process.execPath, [SCRIPT, `--dir=${dir}`, ...args], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const HEALTHY = {
  "a.sql": `create or replace function public.f() returns void
language plpgsql
as $$
begin
  null;
end;
$$;
`,
};

describe("migration preflight — negative controls", () => {
  it("passes a migration with balanced dollar quotes", () => {
    const r = run(HEALTHY, ["a.sql"]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("no structural defects");
  });

  it("FAILS a function body with a missing terminator", () => {
    // The whole point of the check. An unterminated $$ swallows the rest of the
    // file and the parser reports the error somewhere after the real cause.
    const r = run(
      {
        "a.sql": `create or replace function public.f() returns void
language plpgsql
as $$
begin
  null;
end;
`,
      },
      ["a.sql"],
    );
    expect(r.status).toBe(1);
    expect(r.out).toContain("PROBLEMS");
    expect(r.out).toContain("terminator");
  });

  it("FAILS a migration listed as pending that does not exist on disk", () => {
    // Guards against silently checking nothing and reporting success.
    const r = run(HEALTHY, ["not-on-disk.sql"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("not on disk");
  });

  it("FAILS an empty migration file", () => {
    const r = run({ "a.sql": "-- nothing but a comment\n" }, ["a.sql"]);
    expect(r.status).toBe(1);
  });

  it("says plainly that a clean run is not a pass", () => {
    // A green result from this script means "nothing structurally broken".
    // Anyone treating it as "the migrations will apply" is misreading it.
    const r = run(HEALTHY, ["a.sql"]);
    expect(r.out).toContain("NOT proof");
    expect(r.out).toContain("dry-run");
  });

  it("counts a marker inside a comment, because that is still a marker", () => {
    // Deliberate: a $$ written in a comment does open a body to a naive reader,
    // so excluding comments here would hide a real edit accident.
    const r = run({ "a.sql": "-- opens $$ a body\nselect 1;\n" }, ["a.sql"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("odd count");
  });
});

describe("migration preflight — the four pending migrations", () => {
  /** Run against the real migrations directory. */
  function runLive() {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: "utf8" });
    return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
  }

  it("reports exactly four pending and finds them structurally sound", () => {
    const r = runLive();
    expect(r.out).toContain("pending: 4");
    expect(r.status).toBe(0);
  });

  it("does not try to resolve public.x identifiers", () => {
    // Regression control. The removed check reported `on delete cascade` as a
    // missing object, `public.numeric` as one, and table aliases as one.
    // Reintroducing it in any form reintroduces 80 false findings.
    const r = runLive();
    expect(r.out).not.toContain("UNRESOLVED REFERENCES");
  });
});