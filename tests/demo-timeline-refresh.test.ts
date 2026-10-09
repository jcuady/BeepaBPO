import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One-shot seed scripts write demo rows using `Date.now()` offsets — "due +72h
 * from now", "response due +5 days", "interview in 2 days". Those offsets are
 * correct the day they run and decay silently afterwards.
 *
 * That was caught by a gate failure rather than by inspection: `live-data-smoke`
 * asserts the demo ticket carries a future SLA, and it went red with no code
 * change because the seeded deadline had simply slid into the past. An interview
 * had quietly become a past-dated interview.
 *
 * So the rule is: every relative demo timestamp has exactly one repair, they all
 * live in one script, and writing a new repair script per symptom is not allowed.
 */
const refresh = readFileSync(
  join(process.cwd(), "scripts/refresh-demo-timeline.mjs"),
  "utf8",
);

describe("demo timeline refresh", () => {
  it("covers every relative timestamp the seed scripts write", () => {
    // The three offsets found in scripts/audit/ at the time of writing:
    //   batch2-cleanup.mjs:118    tickets.sla_due_at         now + 72h
    //   batch3-workflows.mjs:341  nte_cases.response_due_at now + 5d
    //   batch3-workflows.mjs:219  interviews.scheduled_at    now + 2d
    for (const [table, column] of [
      ["tickets", "sla_due_at"],
      ["nte_cases", "response_due_at"],
      ["interviews", "scheduled_at"],
    ]) {
      const ruleBlock = new RegExp(
        `table:\\s*"${table}"[\\s\\S]{0,200}?column:\\s*"${column}"`,
      );
      expect(
        ruleBlock.test(refresh),
        `${table}.${column} is written with a relative offset by the seed scripts ` +
          `but has no rule in refresh-demo-timeline.mjs, so it will lapse unseen`,
      ).toBe(true);
    }
  });

  it("is dry-run unless --apply is passed", () => {
    expect(refresh).toContain('process.argv.includes("--apply")');
    // The guard must default to NOT writing.
    expect(refresh).toContain(
      'const dryRun = !process.argv.includes("--apply")',
    );
  });

  it("does not touch historical rows", () => {
    // Re-basing an already-answered NTE case or a paid invoice would falsify
    // history, so the rules are scoped to rows still in flight.
    expect(refresh).toContain('r.status === "awaiting_response"');
    expect(refresh).toContain('!["resolved", "closed"].includes(r.status)');
  });

  it("did not leave a one-symptom repair script behind", () => {
    // rearm-demo-ticket-sla.mjs fixed the ticket and nothing else. It was folded
    // into refresh-demo-timeline.mjs (including the resolved_at / first_response_at
    // reset, which a bare timestamp re-base would have missed) and deleted.
    expect(
      existsSync(join(process.cwd(), "scripts/rearm-demo-ticket-sla.mjs")),
      "single-symptom repair script resurrected; add it as a rule instead",
    ).toBe(false);
  });

  it("is not wired into CI", () => {
    // A CI job would rewrite the demo tenant on a schedule nobody reviewed —
    // the same objection that removed the leave-cleanup step.
    const ci = readFileSync(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );
    expect(ci).not.toContain("refresh-demo-timeline");
  });
});