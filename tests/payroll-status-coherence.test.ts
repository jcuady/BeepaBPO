import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  APPROVED_PERIOD_STATUSES,
  PAYABLE_RECORD_STATUSES,
  PAYOUT_RECORD_STATUSES,
  deriveRecordStatusFromPeriod,
  isPeriodApproved,
  isRecordPayable,
  isRecordStatusPayable,
  violatesStatusCoherence,
} from "@/lib/payroll/status-coherence";

/**
 * Payroll period / record status coherence.
 *
 * The failure this guards against is money leaving the company: a `finalized`
 * record inside an unapproved period is downloadable by an employee. It
 * happened. `batch4b-finish.mjs` wrote record status directly with service_role
 * and never touched the period, publishing 500,000 in net pay.
 *
 * There is no database in CI, so the runtime tests cover the pure rule and the
 * source-scan tests pin the writers. Both halves matter: the pure tests would
 * happily pass while a new script reintroduced the direct write.
 */

const PERIOD_STATUSES = [
  "draft",
  "preparing",
  "review",
  "approval",
  "finalized",
  "disbursed",
  "closed",
] as const;

const RECORD_STATUSES = [
  "draft",
  "calculated",
  "review",
  "approved",
  "finalized",
  "paid",
  "void",
] as const;

describe("approved period definition", () => {
  it("treats exactly finalized/disbursed/closed as approved", () => {
    expect([...APPROVED_PERIOD_STATUSES]).toEqual([
      "finalized",
      "disbursed",
      "closed",
    ]);
    for (const status of PERIOD_STATUSES) {
      const expected = [
        "finalized",
        "disbursed",
        "closed",
      ].includes(status);
      expect(isPeriodApproved(status)).toBe(expected);
    }
  });

  it("treats a missing period as not approved", () => {
    // A dropped join must never read as "approved".
    expect(isPeriodApproved(null)).toBe(false);
    expect(isPeriodApproved(undefined)).toBe(false);
    expect(isPeriodApproved("")).toBe(false);
  });

  it("rejects near-miss statuses instead of substring matching", () => {
    // A `LIKE`/`includes` implementation would let 'finalized_pending' through.
    expect(isPeriodApproved("finalized_pending")).toBe(false);
    expect(isPeriodApproved("draft")).toBe(false);
    expect(isPeriodApproved("closed_pending")).toBe(false);
  });
});

describe("payable record requires an approved period", () => {
  it("withholds a finalized record while the period is still a draft", () => {
    // This is the exact live defect: 500,000 of net pay in a draft period.
    expect(isRecordPayable("finalized", "draft")).toBe(false);
    expect(isRecordPayable("paid", "draft")).toBe(false);
  });

  it("allows a finalized record once the period is approved", () => {
    for (const period of APPROVED_PERIOD_STATUSES) {
      expect(isRecordPayable("finalized", period)).toBe(true);
    }
  });

  it("requires both conditions, never either one alone", () => {
    // Approved period, un-finalized record -> still not payable.
    expect(isRecordPayable("calculated", "finalized")).toBe(false);
    expect(isRecordPayable("draft", "closed")).toBe(false);
    // Finalized record, unknown period -> not payable.
    expect(isRecordPayable("finalized", null)).toBe(false);
  });

  it("distinguishes record status from period status for error messages", () => {
    expect(isRecordStatusPayable("finalized")).toBe(true);
    expect(isRecordStatusPayable("calculated")).toBe(false);
  });
});

describe("payout-grade statuses are the ones the trigger rejects", () => {
  it("PAYOUT is narrower than PAYABLE: approved is a legitimate intermediate", () => {
    // The enum has `approved`, and it means "the record is signed off", not
    // "the money is owed". Blocking it would be over-strict and would break
    // any future split between record sign-off and period sign-off.
    expect(PAYABLE_RECORD_STATUSES).toContain("approved");
    expect(PAYOUT_RECORD_STATUSES).not.toContain("approved");
    expect([...PAYOUT_RECORD_STATUSES]).toEqual(["finalized", "paid"]);
  });

  it("flags exactly the incoherent combinations across the full enum", () => {
    const offenders: string[] = [];
    for (const record of RECORD_STATUSES) {
      for (const period of PERIOD_STATUSES) {
        if (violatesStatusCoherence(record, period)) {
          offenders.push(`${record}@${period}`);
        }
      }
    }
    // Every finalized/paid record in every unapproved period. Nothing else.
    expect(offenders.sort()).toEqual(
      [
        "finalized@approval",
        "finalized@draft",
        "finalized@preparing",
        "finalized@review",
        "paid@approval",
        "paid@draft",
        "paid@preparing",
        "paid@review",
      ].sort(),
    );
  });

  it("negative control: the check is not vacuously false", () => {
    // Guards against a rewrite that silently returns false for everything,
    // which would make the audit and the trigger both harmless.
    expect(violatesStatusCoherence("finalized", "draft")).toBe(true);
    expect(violatesStatusCoherence("finalized", "finalized")).toBe(false);
    expect(violatesStatusCoherence("calculated", "draft")).toBe(false);
    expect(violatesStatusCoherence("void", "draft")).toBe(false);
  });
});

describe("seed scripts derive status from the period", () => {
  it("an unapproved period can only ever produce a calculated record", () => {
    for (const status of PERIOD_STATUSES) {
      const derived = deriveRecordStatusFromPeriod(status);
      expect(violatesStatusCoherence(derived, status)).toBe(false);
    }
  });

  it("an approved period is the only source of a finalized record", () => {
    for (const period of PERIOD_STATUSES) {
      expect(deriveRecordStatusFromPeriod(period)).toBe(
        isPeriodApproved(period) ? "finalized" : "calculated",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Source scans. No database in CI, so the writers are pinned by inspection.
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".git")) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|mts)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Directories that can actually write to the database. Walking the whole repo
 * also crawls `e2e-evidence/` (hundreds of screenshot folders) and blows the
 * test timeout for no coverage gain.
 */
const SOURCE_DIRS = ["lib", "app", "components", "scripts", "e2e", "supabase"];

function sourceFiles(): string[] {
  return SOURCE_DIRS.flatMap((dir) => walk(join(process.cwd(), dir)));
}

/** Always forward-slash, so the path predicates below work on Windows too. */
function rel(file: string): string {
  return file.split("\\").join("/");
}

/**
 * Drop whole-line comments before scanning.
 *
 * The files being scanned explain this bug in prose, and that prose contains the
 * very string we are looking for (`status: "finalized"`). Only full-line
 * comments are removed so a `//` inside a URL is left intact.
 */
function stripLineComments(src: string): string {
  return src
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t === "*/");
    })
    .join("\n");
}

const FINALIZES_A_RECORD =
  /from\(["']payroll_records["']\)[\s\S]{0,400}?status:\s*["']finalized["']/;

const FINALIZES_A_PERIOD =
  /from\(["']payroll_periods["']\)[\s\S]{0,400}?status:\s*["']finalized["']/;

/**
 * The rule the scan enforces: a file that finalizes a payroll record must also
 * finalize the payroll period, and must do so FIRST.
 *
 * A naive "no literal finalized on payroll_records" ban would have flagged
 * `scripts/seed-demo.mts`, which is correct -- it finalises the period and only
 * then upserts the record. Order is what matters, so the scan checks order.
 */
function finalizesRecordWithoutPeriodFirst(src: string): boolean {
  const recordAt = src.search(FINALIZES_A_RECORD);
  if (recordAt === -1) return false;
  const periodAt = src.search(FINALIZES_A_PERIOD);
  return periodAt === -1 || periodAt > recordAt;
}

describe("only the approval workflow may finalize a payroll record", () => {
  const ALLOWED = "lib/payroll/actions.ts";

  it("no file finalizes a record without finalizing its period first", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const r = rel(file);
      if (r.endsWith(ALLOWED)) continue;
      // This test file quotes the bug on purpose; so do the other tests.
      if (r.includes("/tests/") || r.endsWith(".test.ts")) continue;

      const src = stripLineComments(readFileSync(file, "utf8"));
      if (finalizesRecordWithoutPeriodFirst(src)) offenders.push(r);
    }
    expect(
      offenders,
      `finalizes a payroll record without approving the period first: ${offenders.join(", ")}`,
    ).toEqual([]);
  }, 30_000);

  it("negative control: the scan detects the original batch4b defect", () => {
    // The pre-fix seed body, verbatim in shape. If this stops matching, the
    // scan above has stopped testing anything.
    const buggy = `
      const updResult = await sb.from("payroll_records").update({
        net_pay: 50000,
        status: "finalized",
      }).eq("id", r.id);
    `;
    expect(FINALIZES_A_RECORD.test(buggy)).toBe(true);
    expect(finalizesRecordWithoutPeriodFirst(buggy)).toBe(true);

    // And the version where the period write is missing.
    const periodMissing = buggy;
    expect(finalizesRecordWithoutPeriodFirst(periodMissing)).toBe(true);

    // And the version where the period is finalized but AFTER the record: the
    // database trigger would reject that, so the scan must too.
    const inverted = `${buggy}\nawait sb.from("payroll_periods").update({ status: "finalized" })`;
    expect(finalizesRecordWithoutPeriodFirst(inverted)).toBe(true);

    // And the correct order, which must pass. This is the case that a naive
    // ban would have wrongly failed.
    const correct = `await sb.from("payroll_periods").update({ status: "finalized" })\n${buggy}`;
    expect(finalizesRecordWithoutPeriodFirst(correct)).toBe(false);

    // And the shipped seed, which derives status instead.
    const fixed = stripLineComments(
      readFileSync(
        join(process.cwd(), "scripts", "audit", "batch4b-finish.mjs"),
        "utf8",
      ),
    );
    expect(finalizesRecordWithoutPeriodFirst(fixed)).toBe(false);
    expect(fixed).toContain("statusFor(period)");
  });

  it("seed-demo.mts is a legitimate control: period first, then record", () => {
    // This file finalises a record, and is correct to do so. It is here to
    // prove the scan discriminates rather than blanket-banning the string.
    const src = stripLineComments(
      readFileSync(join(process.cwd(), "scripts", "seed-demo.mts"), "utf8"),
    );
    expect(FINALIZES_A_RECORD.test(src)).toBe(true);
    expect(finalizesRecordWithoutPeriodFirst(src)).toBe(false);
  });

  it("the seed scripts' approved-period lists match the TS module", () => {
    // The seeds are plain .mjs/.mts and cannot import the TS constant, so they
    // carry literal copies. This is the check that stops those copies drifting.
    for (const script of [
      join("scripts", "audit", "batch4b-finish.mjs"),
      join("scripts", "seed-demo-extended.mts"),
    ]) {
      const src = readFileSync(join(process.cwd(), script), "utf8");
      const match = src.match(
        // `[\s\S]` rather than the /s flag: this project targets below es2018,
        // where the dotAll flag does not exist.
        /APPROVED(?:_PERIOD_STATUSES)?\s*=\s*(?:new Set\()?\[([\s\S]*?)\]/,
      );
      expect(match, `no approved-period list found in ${script}`).not.toBeNull();
      const parsed = [...(match as RegExpMatchArray)[1].matchAll(/"([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(parsed, `approved-period list drifted in ${script}`).toEqual([
        ...APPROVED_PERIOD_STATUSES,
      ]);
    }
  });

  it("no seed script stamps the retired stub engine label", () => {
    // `stub_v1` predates the fixed-salary engine. `20260922120000` writes
    // `fixed_salary_v1`, so a snapshot claiming `stub_v1` misattributes every
    // figure in the payslip audit trail. Both the JS object form and the
    // `jsonb_build_object` SQL form count as stamping the label.
    const retired = /engine:\s*["']stub_v1["']|["']engine["']\s*,\s*["']stub_v1["']/;
    for (const file of walk(join(process.cwd(), "scripts"))) {
      const src = stripLineComments(readFileSync(file, "utf8"));
      expect(retired.test(src), `${rel(file)} still stamps stub_v1`).toBe(false);
    }
    // Negative control: the label is not simply absent from the repository.
    // The original migration still legitimately writes it.
    expect(
      readFileSync(
        join(
          process.cwd(),
          "supabase",
          "migrations",
          "20260906001000_hr_payroll.sql",
        ),
        "utf8",
      ),
    ).toMatch(retired);
  });
});

describe("every surface agrees on where payable starts", () => {
  const TRIGGER = join(
    "supabase",
    "migrations",
    "20261007130000_payroll_record_status_coherence.sql",
  );

  it("the database trigger encodes the same approved-period list", () => {
    const sql = readFileSync(join(process.cwd(), TRIGGER), "utf8");
    for (const status of APPROVED_PERIOD_STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
    for (const status of PAYOUT_RECORD_STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it("the trigger runs as definer with a pinned search_path", () => {
    // Without SECURITY DEFINER the RLS-filtered parent lookup returns nothing
    // for an ordinary session and the trigger reports a false "missing period".
    const sql = readFileSync(join(process.cwd(), TRIGGER), "utf8");
    expect(sql).toContain("security definer");
    expect(sql).toMatch(/set\s+search_path\s*=\s*public,\s*pg_temp/);
    expect(sql).toMatch(
      /revoke execute on function public\.payroll_record_status_requires_approved_period\(\)[\s\S]*?from public, anon, authenticated/,
    );
  });

  it("the coherence audit uses the same lists as the app", () => {
    const audit = readFileSync(
      join(process.cwd(), "scripts", "audit", "audit-payroll-status-coherence.mjs"),
      "utf8",
    );
    for (const status of APPROVED_PERIOD_STATUSES) {
      expect(audit).toContain(`"${status}"`);
    }
    for (const status of PAYOUT_RECORD_STATUSES) {
      expect(audit).toContain(`"${status}"`);
    }
  });

  it("the payslip route and list no longer carry their own status literals", () => {
    const route = readFileSync(
      join(
        process.cwd(),
        "app",
        "app",
        "my",
        "payroll",
        "[recordId]",
        "payslip",
        "route.ts",
      ),
      "utf8",
    );
    const list = readFileSync(
      join(process.cwd(), "app", "app", "my", "payroll", "page.tsx"),
      "utf8",
    );

    for (const src of [route, list]) {
      expect(src).toContain("@/lib/payroll/status-coherence");
    }
    // The duplicated literal arrays that let the surfaces drift.
    expect(route).not.toContain("const PAYABLE_PERIOD_STATUSES");
    expect(route).not.toContain("const PAYABLE_RECORD_STATUSES");
    expect(list).not.toContain('"finalized", "disbursed", "closed"');
    expect(list).not.toContain('"finalized", "paid", "approved"');
  });

  it("the approval workflow finalizes the period before cascading to records", () => {
    // The trigger permits the cascade only because the period is already
    // finalized when the records are updated. If this order ever inverts, the
    // legitimate payroll approval path starts failing in production.
    const src = readFileSync(join(process.cwd(), "lib", "payroll", "actions.ts"), "utf8");
    const periodWrite = src.indexOf('.from("payroll_periods")');
    const recordWrite = src.indexOf('.from("payroll_records")');
    expect(periodWrite).toBeGreaterThan(-1);
    expect(recordWrite).toBeGreaterThan(periodWrite);
    // Both writes are guarded by the same finalized transition.
    expect(src).toContain('if (nextStatus === "finalized")');
  });
});