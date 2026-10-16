import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `evidence: null` was an exemption, and it was the most load-bearing one in the
 * repository.
 *
 * `qa-run-all.mjs` states its own rule at the top: "Every entry must declare its
 * own evidence file, so a green summary always has a file behind it", and it
 * enforces the rule by reporting `missingEvidence` when a declared file was not
 * written. Ten of thirty checks declared `evidence: null` — and a check with no
 * declared file is skipped by that rule entirely. The rule had a hole shaped
 * exactly like the thing it was written to catch, and six matrix rows quoted
 * numbers from checks sitting in the hole.
 *
 * Two ways this failed, and only the second is subtle:
 *
 *   1. `server-fresh` wrote `docs/evidence/server-fresh.json` and its registry row
 *      still said `evidence: null`. The file existed; the runner reported no
 *      evidence. So the row could not be trusted as a description of the script
 *      — it had already drifted once, in the direction that hides.
 *   2. A check declared `evidence: null` forever and nobody noticed, because
 *      "no evidence file" and "exempt by declaration" are the same output.
 *
 * So the guard below is deliberately narrow: it reads the real registry, and it
 * fails if any check outside the one legitimate exemption declares no evidence.
 *
 * The one exemption is `gate` itself — vitest and tsc report to a terminal, and
 * their result is not a file. It is named rather than pattern-matched so that
 * adding a second exempt row is a visible diff to this list, not something a
 * regex quietly allows.
 */

const ROOT = process.cwd();
const REGISTRY = join(ROOT, "scripts", "audit", "qa-run-all.mjs");

/**
 * `gate` is vitest + tsc. Not a file-producing check by nature.
 *
 * Named explicitly, with the reason, because the alternative — allowing any row
 * whose evidence is null — is the bug this file exists to prevent.
 */
const EXEMPT = new Set(["gate"]);

type Row = { id: string; evidence: string | null };

/**
 * The shape of an evidence file as far as THIS file cares.
 *
 * Deliberately not `any` and deliberately not a full schema. Every gate writes a
 * different payload; what is common is that it is a JSON object carrying at least
 * one of three timestamp keys. Typing it as `any` silences the linter and also
 * silences the compiler on typos in the fields this file reads, which is the half
 * of the rule that matters.
 */
type Evidence = Record<string, unknown> & {
  generatedAt?: string;
  when?: string;
  startedAt?: string;
  builtAt?: string;
};

/**
 * Parse the `CHECKS` array out of the registry source.
 *
 * Parsed with a regex rather than by importing the module because the module
 * *runs* the suite on import — importing it to read its data would fire twenty
 * browser sweeps.
 *
 * Row-splitting is line-anchored rather than brace-balanced. The first draft used
 * `\{\s*id:"…"[\s\S]*?\}` and matched only 25 of 30 rows: five rows carry an
 * `env: { … }` block, and the non-greedy match stopped at that INNER brace, so
 * those five silently contributed no `evidence` and were counted as clean. A
 * parser that drops rows cannot detect a missing field in them — it just doesn't
 * see them. The `parsedCount` assertion below exists to catch exactly that, and
 * it fired.
 */
function parseRegistry(src: string): Row[] {
  const start = src.indexOf("const CHECKS = [");
  expect(start, "the registry must still declare `const CHECKS = [`").toBeGreaterThan(-1);
  const end = src.indexOf("\n];", start);
  expect(end, "the CHECKS array must still close on its own `];` line").toBeGreaterThan(start);

  const rows: Row[] = [];
  for (const line of src.slice(start, end).split(/\r?\n/)) {
    const id = /^\s*\{\s*id:\s*"([^"]+)"/.exec(line);
    if (!id) continue;
    const ev = /evidence:\s*(null|"([^"]+)")/.exec(line);
    // A row with no `evidence:` key at all is a THIRD way to be absent from the
    // rule — distinct from declaring null — so it is recorded as null here and
    // then fails the exemption test below, rather than being skipped.
    rows.push({ id: id[1], evidence: ev ? (ev[1] === "null" ? null : ev[2]) : null });
  }
  return rows;
}

describe("no QA check may exempt itself from the evidence rule", () => {
  const src = readFileSync(REGISTRY, "utf8");
  const rows = parseRegistry(src);

  it("parsed the whole registry rather than a fragment of it", () => {
    // A parser that silently matched 25 of 30 rows would report "no exemptions"
    // and be exactly as wrong as the bug it replaces. This assertion is the
    // reason the count is compared against an independent count of the ids.
    //
    // The independent count scans the SAME region — between `const CHECKS = [` and
    // its closing `];` — not the whole file. Counting the whole file finds one more,
    // because `runGates()` below has a second `id:`, and the first draft of this
    // test failed 30-vs-31 for a reason that had nothing to do with the registry.
    // The rule: a cross-check must measure the same subject, or it is measuring
    // the wrong difference. Both bounds are needed — an index filter alone still
    // matched every row, because all of them sit after the opening.
    //
    // The pinned number moves when a check is added, and that is the point of pinning
    // it: adding `auth-callback` took this from 31 to 32 and turned this red until
    // the count was acknowledged. A parser that had silently stopped matching rows
    // would move this number too, which is why it is compared against an independent
    // count on the line above rather than trusted as a constant.
    const start = src.indexOf("const CHECKS = [");
    const end = src.indexOf("\n];", start);
    const ids = [...src.slice(start, end).matchAll(/\{\s*id:\s*"([^"]+)"/g)];
    expect(rows.length).toBe(ids.length);
    expect(rows.length).toBe(32);
    // And the exempt one is the gate, named in this file's own EXEMPT set.
    expect(rows.filter((r) => EXEMPT.has(r.id)).map((r) => r.id)).toEqual(["gate"]);
  });

  it("declares an evidence file for every check that is not the gate itself", () => {
    const exempting = rows.filter((r) => !EXEMPT.has(r.id) && r.evidence === null);
    expect(
      exempting.map((r) => r.id),
      // The message is the finding. This is the exact list §2.9 of
      // docs/REMAINING_WORK.md was about, so the failure names the same thing.
      "these checks declare `evidence: null`, which exempts them from the runner's missing-evidence rule rather than satisfying it",
    ).toEqual([]);
  });

  it("points every declared evidence file at docs/evidence/", () => {
    // Otherwise a file can be declared into a path nothing ever reads, and the
    // check passes the registry test while producing no readable evidence.
    const stray = rows.filter(
      (r) => r.evidence !== null && !r.evidence.startsWith("docs/evidence/"),
    );
    expect(stray.map((r) => `${r.id} -> ${r.evidence}`)).toEqual([]);
  });
});

describe("every declared evidence file exists, and is a recent measurement", () => {
  const rows = parseRegistry(readFileSync(REGISTRY, "utf8")).filter(
    (r) => r.evidence !== null,
  );

  it("has a file on disk for every declared path", () => {
    const missing = rows
      .map((r) => r.evidence!)
      .filter((p) => !existsSync(join(ROOT, p)));
    expect(missing, "the registry promises evidence that was never written").toEqual([]);
  });

  it("parses as JSON and carries a timestamp that can be dated against the build", () => {
    // Every evidence file here is read by a person deciding whether to trust a
    // number, and the first question is always "when?". An undated measurement
    // cannot be compared to the build it described — which is the whole failure
    // `audit-server-fresh` exists to prevent, applied to files instead of processes.
    //
    // THREE timestamp keys are accepted, not one. `workflow-summary.json`,
    // `workflow-assertion-index.json`, `role-sweep.json` and
    // `control-surface-census.json` were written before `generatedAt` was the
    // convention and use `when` or `startedAt`. The first draft demanded
    // `generatedAt` specifically and failed on four files that were in fact
    // perfectly datable — inventing a schema violation out of a naming habit is
    // the confident-nonsense finding class, and it is exactly what gets a gate
    // switched off.
    //
    // No `check` field is demanded either, and that is deliberate: attribution
    // already exists. Each path is named by a registry row with an `id`, so
    // `docs/evidence/role-sweep.json` is attributable by the row that declares it.
    // Requiring a redundant field would be enforcing ceremony, not evidence.
    const bad: string[] = [];
    for (const r of rows) {
      if (!existsSync(join(ROOT, r.evidence!))) continue;
      let j: Evidence;
      try {
        j = JSON.parse(readFileSync(join(ROOT, r.evidence!), "utf8"));
      } catch {
        bad.push(`${r.evidence}: not valid JSON`);
        continue;
      }
      const ts = j.generatedAt ?? j.when ?? j.startedAt ?? j.builtAt;
      if (typeof ts !== "string" || Number.isNaN(Date.parse(ts))) {
        bad.push(`${r.evidence}: no datable timestamp (generatedAt/when/startedAt)`);
      }
      // A file that parses to an empty object is not evidence of anything.
      if (Object.keys(j).length === 0) bad.push(`${r.evidence}: parses to an empty object`);
    }
    expect(bad).toEqual([]);
  });

  it("carries a timestamp that is not older than a month", () => {
    // A deliberately WEAK floor, and the reason it is weak is worth recording.
    //
    // The obvious stronger version — "evidence must not predate `.next/BUILD_ID`" —
    // was written and then deleted. It fails on 21 of 29 files, permanently,
    // because a build is newer than the evidence until you re-run the suite, and
    // this repository rebuilds many times per pass. A gate that is red by
    // construction teaches people to ignore red; that is the exact failure
    // `smoke-cron.mjs`'s own comment describes ("a permanently red gate that
    // teaches people to ignore red").
    //
    // So the real freshness question — "is this measurement describing the build
    // on disk?" — is answered by `audit-server-fresh` and by each file's own
    // embedded `generatedAt`, not by mtime comparison against a build that moves.
    // What this assertion catches instead is the failure that actually happens: a
    // file that was committed once and never regenerated, sitting in the tree
    // looking exactly as authoritative as one that was.
    const stale: string[] = [];
    const now = Date.now();
    for (const r of rows) {
      if (!existsSync(join(ROOT, r.evidence!))) continue;
      let j: Evidence;
      try {
        j = JSON.parse(readFileSync(join(ROOT, r.evidence!), "utf8"));
      } catch {
        continue; // already reported by the schema test above
      }
      const ts = Date.parse(j.generatedAt ?? j.when ?? j.startedAt ?? "");
      if (!Number.isNaN(ts) && now - ts > 30 * 24 * 3600 * 1000) {
        stale.push(`${r.evidence} — ${Math.round((now - ts) / 86400000)} days old`);
      }
    }
    expect(
      stale,
      "evidence older than 30 days describes a build that is gone. Re-run the check that writes it.",
    ).toEqual([]);
  });
});

/**
 * Proof that writing the file is a behaviour of the script, not a comment in it.
 *
 * Each of the three static gates below is run against a FIXTURE that is
 * guaranteed to fail, in a temp directory, and the file is read back from there.
 * If the evidence write sat on the success path only, or behind a condition the
 * failing run does not reach, this suite would pass on the gate being *present*
 * while proving nothing about it *firing*.
 *
 * These are the cheap ones precisely because they need no server: a fixture is
 * enough. The five server-backed gates are covered by the shape assertions below
 * plus their own exit-2 paths, and each was run against the live server to
 * produce a real file.
 */
/**
 * A test that runs a gate which writes committed evidence must not write it.
 *
 * This class of bug was introduced by this very pass and then found by it, which
 * is the only reliable way these are ever found. `audit-suite-base-url.mjs` and
 * `audit-form-reset-defaults.mjs` gained evidence files; two fixture tests in
 * `tests/audit-gate-integrity.test.ts` ran them with `cwd: ROOT` against a
 * one-file planted input; and the repository committed
 * `suite-base-url.json → httpScripts: 0, verdict: "unknown"` and
 * `form-reset-defaults.json → scanned: 1` as though those were measurements of
 * the real codebase. The matrix quotes both numbers.
 *
 * The gates now route fixture runs to the fixture's own cwd, and the two tests
 * pass a disposable cwd. Both halves are asserted here, because either alone
 * leaves the trap open: fixing only the caller means the next caller forgets,
 * and fixing only the gate means the next gate repeats it.
 */
/**
 * The unlinked-employee probe's PREMISE, pinned at the source level.
 *
 * The rendered proof is its own run — a fixture in a temp directory cannot
 * produce a Supabase-backed account — so what is asserted here is that the state
 * the probe claims to build is still the state the code produces.
 *
 * The specific failure this guards against is a probe that stops being able to
 * build its state and reports "clean" anyway. If `employees` ever gets a NOT NULL
 * profile link that auto-creates, or `resolveEmployeeForUser` starts falling back
 * to a different table, the probe would still sign in, still load five pages, and
 * still write `verdict: clean` — measuring the wrong state without noticing. That
 * is the same failure as a gate whose fixture silently stopped differing from
 * production, and it is invisible from the output.
 */
describe("the unlinked-employee probe still builds a state no demo account has", () => {
  const probe = readFileSync(
    join(ROOT, "scripts", "audit", "qa-probe-unlinked-employee.mjs"),
    "utf8",
  );

  it("asserts the absence of an employees row rather than assuming it", () => {
    // Without this the fixture could acquire a record and the run would silently
    // become a measurement of the ordinary branch.
    expect(probe).toMatch(/from\("employees"\)\s*\.select\("id"\)\s*\.eq\("profile_id", userId\)/);
    expect(probe).toMatch(/fixture is invalid/);
  });

  it("creates the account outside the demo login picker", () => {
    // The reason this was declined for months: a 14th entry in
    // `lib/demo/users.ts` becomes a button on the public login page. Built per
    // run and deleted, nothing visible is added.
    const users = readFileSync(join(ROOT, "lib", "demo", "users.ts"), "utf8");
    expect(users).not.toContain("qa.unlinked");
    expect(probe).toMatch(/@nowhere\.example/);
  });

  it("deletes what it creates, and asserts the deletion", () => {
    // A silently-failed cleanup leaves a real auth user behind, and the next run
    // creates a second one.
    expect(probe).toMatch(/auth\.admin\.deleteUser/);
    expect(probe).toMatch(/getUserById/);
    expect(probe).toMatch(/throwaway account is deleted after the run/);
    expect(probe).toMatch(/membership_roles"\)\.delete/);
    expect(probe).toMatch(/organization_memberships"\)\.delete/);
  });

  it("measures the viewport where the 16px rule actually applies", () => {
    // `text-base … sm:text-sm` is 16px below 640px and 14px above, and the
    // repository's rule is "body text below 16px ON NARROW SCREENS". A desktop
    // run measured against 16px fails all five pages on the very 14px that §2.8
    // deliberately kept — the probe reporting its own scope as a defect.
    expect(probe).toMatch(/390,\s*h:\s*844[^\n]*minPx:\s*16/);
    expect(probe).toMatch(/1440,\s*h:\s*900[^\n]*minPx:\s*0/);
  });

  it("excludes unpainted elements rather than guessing at selectors", () => {
    // The command palette's `<p>` is in the layout on every route and is not a
    // `role="dialog"` in the DOM, so a selector list missed it and the probe
    // failed all five pages on it forever. A zero-size rect catches whatever is
    // not painted, which is the actual question.
    expect(probe).toMatch(/getBoundingClientRect\(\)/);
    expect(probe).toMatch(/r\.width === 0 && r\.height === 0/);
  });

  it("is registered in the suite with an evidence file", () => {
    const rows = parseRegistry(readFileSync(REGISTRY, "utf8"));
    const row = rows.find((r) => r.id === "unlinked-employee");
    expect(row).toBeDefined();
    expect(row!.evidence).toBe("docs/evidence/unlinked-employee-check.json");
  });
});

describe("a fixture run cannot overwrite the repository's evidence", () => {
  const FIXTURE_GATES = [
    { script: "scripts/audit/audit-suite-base-url.mjs", flag: "--dir=" },
    { script: "scripts/audit/audit-form-reset-defaults.mjs", flag: "--dir=" },
  ];

  it.each(FIXTURE_GATES)("$script routes a --dir= run beside its input", ({ script }) => {
    const src = readFileSync(join(ROOT, script), "utf8");
    // Beside the INPUT — `ROOTS[0]`, which `--dir` names.
    //
    // Not `process.cwd()`. That was the first version of this guard and it reads
    // like a fix while doing nothing, because the caller is what controls the
    // working directory — the exact thing that went wrong. A test spawning from
    // the repo root got the repo. It was caught by the byte-comparison test below,
    // which is why that test is here and not just the regex.
    //
    // The negative check reads the CODE, not the file: the comment above the guard
    // deliberately quotes the wrong expression to explain why it was rejected, so a
    // whole-file match finds it there and fails a correct script.
    const code = src
      .split(/\r?\n/)
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(code).toMatch(/SCANNING_FIXTURE\s*\?\s*ROOTS\[0\]\s*:\s*ROOT/);
    expect(code).not.toMatch(/SCANNING_FIXTURE\s*\?\s*process\.cwd\(\)/);
    // And an absolute fallback, so the non-fixture path does not ALSO depend on
    // cwd — otherwise the fix trades one untrusted input for another.
    //
    // `fileURLToPath`, asserted by name because the hand-stripped
    // `URL.pathname` regex compiles, runs, and silently resolves to the wrong
    // place on Windows. That is how an earlier draft of this guard shipped doing
    // nothing at all.
    expect(src).toMatch(/fileURLToPath\(new URL\("\.\.\/\.\."/);
  });

  it.each(FIXTURE_GATES)("$script leaves the real evidence untouched when run on a fixture", ({ script, flag }) => {
    const evidenceName = script.includes("suite-base-url")
      ? "suite-base-url.json"
      : "form-reset-defaults.json";
    const realEvidence = join(ROOT, "docs", "evidence", evidenceName);
    const before = readFileSync(realEvidence, "utf8");

    // Deliberately run from ROOT, the way the failing test did.
    const fixture = mkdtempSync(join(tmpdir(), "clobber-"));
    try {
      writeFileSync(join(fixture, "bad.mjs"), `const b = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";\nawait fetch(b);\n`, "utf8");
      writeFileSync(
        join(fixture, "bad-form.tsx"),
        `"use client";\nexport function F(){const form=useForm({defaultValues:{reason:""}});return <form><input {...form.register("reason")}/><input {...form.register("when")}/><button onClick={()=>form.reset({...defaults})}>R</button></form>;}\nconst defaults={reason:""};\n`,
        "utf8",
      );
      spawnSync(process.execPath, [join(ROOT, script), `${flag}${fixture}`], {
        cwd: ROOT,
        encoding: "utf8",
      });
      // The repository's measurement is byte-for-byte what it was. The planted
      // run wrote its evidence inside the fixture directory instead.
      expect(readFileSync(realEvidence, "utf8")).toBe(before);
      // And the fixture run did produce a file — otherwise this test would pass
      // simply because the gate stopped writing anything at all.
      expect(existsSync(join(fixture, "docs", "evidence", evidenceName))).toBe(true);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("marks its own fixture output, so a stray file is self-identifying", () => {
    // Belt and braces. Even if one lands in the wrong place, `scanningFixture:
    // true` says so without needing to know where it was written from.
    const fixture = mkdtempSync(join(tmpdir(), "marked-"));
    try {
      writeFileSync(join(fixture, "ok.mjs"), `const B = process.env.QA_BASE_URL ?? "http://localhost:3100";\nawait fetch(B);\n`, "utf8");
      const r = spawnSync(
        process.execPath,
        [join(ROOT, "scripts", "audit", "audit-suite-base-url.mjs"), `--dir=${fixture}`],
        { cwd: fixture, encoding: "utf8" },
      );
      expect(r.status).toBe(0);
      const j = JSON.parse(readFileSync(join(fixture, "docs", "evidence", "suite-base-url.json"), "utf8"));
      expect(j.scanningFixture).toBe(true);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});

describe("the static gates write evidence on their FAILING path too", () => {
  /**
   * Run a gate with a planted fixture, and read the evidence it wrote.
   *
   * `cwd` is the fixture directory AND `--dir=` names the same directory, so the
   * two are interchangeable here — but they are not interchangeable in general,
   * which is the point: the gate writes BESIDE ITS INPUT (`ROOTS[0]`), so the
   * evidence lands in the fixture no matter where the caller ran from. The first
   * version of this helper ran with `cwd: ROOT` and read from `dir/docs/evidence`,
   * so it found nothing while the gate wrote a fixture result straight into the
   * repository. The proof that the gate does the right thing is in the
   * "leaves the real evidence untouched" test, which compares bytes.
   */
  function runInTemp(scriptRel: string, args: string[]) {
    const dir = mkdtempSync(join(tmpdir(), "evidence-write-"));
    // `--dir=` names the INPUT, and these gates write their evidence BESIDE the
    // input (`ROOTS[0]`). So the directory to read back is whichever one
    // `--dir=` pointed at, not necessarily `cwd` — and `dir` must already exist
    // for the `?? dir` fallback, hence the ordering.
    //
    // Deriving it from the args rather than from `cwd` is the point: the first
    // version read from `cwd` while several callers passed a different `--dir`,
    // so it looked in a directory the gate had never written to and reported
    // `null` — while the gate was in fact writing a fixture result straight into
    // the repository. That is the bug this whole section was written to close.
    const dirArg = args.find((a) => a.startsWith("--dir="));
    const evidenceRoot = dirArg ? dirArg.slice("--dir=".length) : dir;
    try {
      const r = spawnSync(process.execPath, [join(ROOT, scriptRel), ...args], {
        cwd: dir,
        encoding: "utf8",
      });
      const evidenceDir = join(evidenceRoot, "docs", "evidence");
      // Read EAGERLY, before the `finally` deletes the dir. Returning a closure
      // here reads as tidier and is exactly the bug: every caller invoked it
      // against a path that no longer existed.
      const files: Record<string, Evidence> = {};
      if (existsSync(evidenceDir)) {
        for (const name of readdirSync(evidenceDir)) {
          files[name] = JSON.parse(readFileSync(join(evidenceDir, name), "utf8"));
        }
      }
      return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? ""), read: (n: string) => files[n] ?? null };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("audit-suite-base-url records the drift it found", () => {
    const dir = mkdtempSync(join(tmpdir(), "drifted-"));
    try {
      writeFileSync(join(dir, "bad.mjs"), `const b = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";\nawait fetch(b);\n`, "utf8");
      const r = runInTemp("scripts/audit/audit-suite-base-url.mjs", [`--dir=${dir}`]);
      expect(r.status).toBe(1);
      const j = r.read("suite-base-url.json");
      expect(j).not.toBeNull();
      expect(j.verdict).toBe("drift");
      expect(j.exitCode).toBe(1);
      // The finding itself, not just a count — a reader must be able to see WHICH
      // script drifted without re-running the gate.
      expect(j.findings).toEqual(
        expect.arrayContaining([expect.objectContaining({ file: expect.stringContaining("bad.mjs") })]),
      );
      // And the denominator, so "1 finding" is not read as "1 of 1 scripts agree".
      expect(j.httpScripts).toBe(1);
      expect(j.checked).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("audit-gate-coverage records the ungated audit it found", () => {
    const dir = mkdtempSync(join(tmpdir(), "coverage-"));
    try {
      mkdirSync(join(dir, "scripts", "audit"), { recursive: true });
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ scripts: { "audit:a": "node scripts/a.mjs", "audit:orphan": "node scripts/orphan.mjs" } }),
        "utf8",
      );
      writeFileSync(join(dir, "scripts", "audit", "qa-run-all.mjs"), 'spawn("node", ["scripts/a.mjs"]);', "utf8");
      writeFileSync(join(dir, "scripts", "verify-all.mjs"), 'spawn("node", ["scripts/a.mjs"]);', "utf8");
      const r = spawnSync(process.execPath, [join(ROOT, "scripts", "audit", "audit-gate-coverage.mjs")], {
        cwd: dir,
        encoding: "utf8",
      });
      expect(r.status).toBe(1);
      const j = JSON.parse(readFileSync(join(dir, "docs", "evidence", "gate-coverage.json"), "utf8"));
      expect(j.verdict).toBe("gap");
      expect(j.ungatedCount).toBe(1);
      expect(j.ungated[0].name).toBe("audit:orphan");
      // Without the denominator, `ungatedCount: 1` is equally consistent with a
      // repo that declared two audits and a repo that declared one.
      expect(j.declaredCount).toBe(2);
      expect(j.gatedCount).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("audit-form-reset-defaults records the field that survives a reset", () => {
    const dir = mkdtempSync(join(tmpdir(), "reset-"));
    try {
      // A form that registers three fields and defaults one — the exact defect
      // the gate was written for.
      writeFileSync(
        join(dir, "bad-form.tsx"),
        [
          `"use client";`,
          `export function BadForm() {`,
          `  const form = useForm({ defaultValues: { reason: "" } });`,
          `  const onReset = () => form.reset({ ...defaults });`,
          `  return <form><input {...form.register("reason")} />`,
          `    <input {...form.register("start_date")} />`,
          `    <input {...form.register("end_date")} />`,
          `    <button type="button" onClick={onReset}>Reset</button></form>;`,
          `}`,
          `const defaults = { reason: "" };`,
        ].join("\n"),
        "utf8",
      );
      const r = runInTemp("scripts/audit/audit-form-reset-defaults.mjs", [`--dir=${dir}`]);
      expect(r.status).toBe(1);
      const j = r.read("form-reset-defaults.json");
      expect(j).not.toBeNull();
      expect(j.missingDefaultCount).toBe(1);
      // The two dates are the whole point of the finding: they survive a reset
      // the user believes cleared them.
      expect(j.findings).toEqual([
        expect.objectContaining({ missing: ["end_date", "start_date"] }),
      ]);
      // `scanningFixture` exists so a planted run can never be mistaken for a
      // clean measurement of the real codebase.
      expect(j.scanningFixture).toBe(true);
      expect(j.scanned).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records 'cannot tell' rather than nothing when a gate cannot look", () => {
    // Silence and a clean run are the same absence of information. The abort
    // paths have to leave a file too, or "we did not measure" is
    // indistinguishable from "nothing was wrong" — which is the entire class of
    // defect these gates were added to end.
    //
    // The root is an EMPTY directory that really exists, not a nonexistent path.
    // It was a nonexistent path in the first version, which contradicted the
    // guard added in the same pass: the gate writes evidence BESIDE its input, so
    // pointing `--dir` at a directory that is not there means `mkdirSync` creates
    // it and the test's own premise stops holding. The abort still fires — the
    // gate finds no `.tsx` under an empty tree — and now the file lands somewhere
    // that was meant to receive it.
    const empty = mkdtempSync(join(tmpdir(), "empty-"));
    try {
      const r = runInTemp("scripts/audit/audit-form-reset-defaults.mjs", [`--dir=${empty}`]);
      expect(r.status).toBe(2);
      const j = r.read("form-reset-defaults.json");
      expect(j).not.toBeNull();
      expect(j.verdict).toBe("unknown");
      expect(j.scanned).toBe(0);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

/**
 * The server-backed gates cannot be fixture-tested cheaply, so their evidence
 * write is pinned structurally: the write must be reachable from more than the
 * success path, and must include the measurement rather than a bare verdict.
 *
 * This is weaker than the fixture proofs above and is labelled as such. The
 * compensating check is that each of these five was executed against the live
 * server in this pass and its file is listed in the registry test above, which
 * fails if the file is absent.
 */
// KNOWN LIMIT, recorded here rather than asserted on, on purpose.
//
// `verify-attendance-tz.mjs` wraps its browser work in `try { … } catch (err)` and
// writes evidence on the error path. The other four do not, so a mid-run crash —
// server restart, Playwright launch failure, a network drop — leaves the PREVIOUS
// run's file in place: dated, parseable, and describing a build that is gone.
//
// This was briefly a test that counted `catch (` in each file and asserted the
// expected list. It gave the wrong answer for two of five, because a regex cannot
// tell a guard that wraps the whole run from one that wraps a single awaited
// call: `audit-seo-metadata.mjs` and `smoke-cron.mjs` both contain a `catch`, and
// in both it is narrow. A check that cannot distinguish the thing it names is worse
// than no check, so the count was deleted rather than made to pass.
//
// Closing it properly means wrapping four scripts in try/catch — a change to
// product-adjacent tooling that belongs in its own pass, with its own evidence.
// The 30-day staleness floor above is the compensating control: it cannot catch a
// crash, but it does stop a stale file from looking authoritative forever.

describe("the server-backed gates write evidence that contains the measurement", () => {
  // `minWriteSites` is per-gate, not a flat threshold. `audit-performance.mjs` has
  // exactly two by design: it runs to completion or throws, so it has a single
  // verdict site and no "cannot tell" branch. Demanding four of it was the test
  // asserting a shape the script has no reason to have — the same
  // ceremony-not-evidence mistake the timestamp key nearly caused. The gate that
  // matters is the one below it: a THROWN script still leaves no file, and that is
  // recorded as a known limit rather than papered over.
  const cases: Array<{ script: string; file: string; patterns: RegExp[]; minWriteSites: number }> = [
    {
      script: "scripts/audit/audit-seo-metadata.mjs",
      file: "seo-metadata.json",
      patterns: [/urlsChecked/, /failureCount/, /writeEvidence\(2/],
      minWriteSites: 4,
    },
    {
      script: "scripts/audit-performance.mjs",
      file: "performance.json",
      patterns: [/measured:/, /unmeasured:/, /budget: BUDGET/, /writeEvidence\(overBudget/],
      minWriteSites: 2,
    },
    {
      script: "scripts/audit/audit-unapproved-payslip-exposure.mjs",
      file: "payslip-exposure.json",
      patterns: [/unapprovedCount/, /exposedCount/, /writeEvidence\(2/],
      minWriteSites: 4,
    },
    {
      script: "scripts/audit/verify-attendance-tz.mjs",
      file: "attendance-tz.json",
      patterns: [/expectedClockIn/, /workDate/, /writeEvidence\(2/],
      minWriteSites: 3,
    },
    {
      script: "scripts/smoke-cron.mjs",
      file: "cron-smoke.json",
      patterns: [/unauthenticatedStatus/, /writeEvidence\(1/, /writeEvidence\(2/],
      minWriteSites: 5,
    },
  ];

  it.each(cases)("$script writes $file with its measurement", ({ script, file, patterns, minWriteSites }) => {
    const src = readFileSync(join(ROOT, script), "utf8");
    // It writes THAT file, not some other one — a script that wrote its evidence
    // under a different name would satisfy a presence check while the registry
    // pointed at nothing.
    //
    // The check is for the path without surrounding quotes: every one of these
    // scripts declares `const EVIDENCE = "docs/evidence/<name>.json"`, so the
    // quoted basename alone never appears in the source. The first draft asserted
    // on `'"<name>.json"'` and failed on all five while the scripts were correct.
    expect(src).toContain(file);
    for (const p of patterns) expect(src).toMatch(p);
    expect(src.match(/writeEvidence\(/g)?.length ?? 0).toBeGreaterThanOrEqual(minWriteSites);
  });

  it("cron-smoke records the refusal status, which is the actual claim", () => {
    // "The cron endpoint refuses unauthenticated calls" is a claim about a status
    // code. The evidence file has to carry that number or the claim is
    // unfalsifiable from the file alone.
    const src = readFileSync(join(ROOT, "scripts", "smoke-cron.mjs"), "utf8");
    expect(src).toMatch(/unauthenticatedStatus:\s*unauth\.status/);
  });

  it("payslip-exposure records unapprovedCount so an empty run cannot read as a pass", () => {
    // Zero unapproved records means the refusal path was never exercised. The
    // file must make that visible, or "CLEAN" is reported for a check that had
    // no opportunity to fire.
    const src = readFileSync(join(ROOT, "scripts", "audit", "audit-unapproved-payslip-exposure.mjs"), "utf8");
    expect(src).toMatch(/unapprovedCount:\s*unapproved\.length/);
  });
});