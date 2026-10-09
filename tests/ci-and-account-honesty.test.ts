import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CI workflow + account honesty seams", () => {
  const ci = readFileSync(
    join(process.cwd(), ".github/workflows/ci.yml"),
    "utf8",
  );
  const header = readFileSync(
    join(process.cwd(), "components/app/app-header.tsx"),
    "utf8",
  );
  const nav = readFileSync(
    join(process.cwd(), "lib/app/navigation.ts"),
    "utf8",
  );

  it("quotes AUTH_SECRET and does not gate jobs on secrets.*", () => {
    expect(ci).toContain('AUTH_SECRET: "beepa-ci-secret-change-me-32chars!!"');
    expect(ci).not.toMatch(/if:.*secrets\./);
    expect(ci).toContain("vars.RUN_E2E");
    expect(ci).not.toMatch(/pnpm\/action-setup@v4\s*\n\s*with:\s*\n\s*version:/);
    expect(ci).toContain("node-version: 22");
  });

  it("routes Settings and notifications to real pages", () => {
    expect(header).toContain('settingsHref: "/app/my/settings"');
    expect(header).toContain('notificationsHref: "/app/client/notifications"');
    expect(header).toContain(
      'notificationsHref: "/app/applicant/notifications"',
    );
  });

  it("exposes cash advances and payroll approval nav gates", () => {
    expect(nav).toContain("/app/my/cash-advances");
    expect(nav).toContain('"payroll.manage"');
    expect(nav).toContain('"payroll.approve"');
  });
});

/**
 * The e2e job used to be a switch that flipped to "everything fails".
 *
 * It was gated on `vars.RUN_E2E == 'true'` and nothing else — no build, no
 * server, no cleanup. Turning it on would have pointed Playwright at a port
 * nobody was listening on, and `mutations.spec.ts` would have left a duplicate
 * leave row behind that made the *next* run red for an unrelated reason.
 *
 * Parsed structurally rather than with regex-over-the-whole-file: the assertions
 * are about steps and their env keys, and a flat string search cannot tell you
 * whether `PLAYWRIGHT_BASE_URL` is on the step that actually runs Playwright.
 * No YAML parser is used because `yaml` is only a transitive dependency here and
 * is not resolvable from the project root — importing it would mean adding a
 * dependency for a test, and a test that silently skips is worse than none.
 */
describe("CI e2e job is runnable, not just switchable", () => {
  const ci = readFileSync(
    join(process.cwd(), ".github/workflows/ci.yml"),
    "utf8",
  );

  /** Step blocks are separated by a `      - ` at the steps list indentation. */
  function e2eSteps(): string[] {
    const start = ci.indexOf("\n  e2e:");
    expect(start, "ci.yml must declare an e2e job").toBeGreaterThan(-1);
    const body = ci.slice(start);
    return body
      .split("\n      - ")
      .slice(1)
      // Comments are indented deeper than the list marker, so they land inside
      // whichever block precedes them. Matching text without stripping them
      // finds "playwright test" in a *comment* and counts a step that does not
      // exist — the same class of bug as an auditor reading its own
      // documentation as a violation.
      .map((b) =>
        b
          .split("\n")
          .filter((line) => !line.trim().startsWith("#"))
          .join("\n"),
      )
      .map((b) => `      - ${b}`);
  }

  const steps = e2eSteps();

  it("builds and serves a production bundle before running any test", () => {
    // `playwright.config.ts` only auto-starts a webServer when
    // PLAYWRIGHT_BASE_URL is unset, and it starts a *dev* server. Without an
    // explicit build+start, four sequential projects would each pay a dev
    // compile and exercise behaviour that is not what ships.
    //
    // Matched against the whole block, not the `run:` line: the start step uses
    // a YAML block scalar, so its command is on the following lines.
    const hasBuild = steps.some((s) => /\brun:[\s\S]*?pnpm build/.test(s));
    const hasStart = steps.some((s) => /\brun:[\s\S]*?pnpm start/.test(s));
    expect(hasBuild, "e2e job never builds").toBe(true);
    expect(hasStart, "e2e job never starts a server").toBe(true);
  });

  it("gives every playwright step a base URL so webServer stays out of the way", () => {
    // `--project=` rather than "playwright test", so the doc comment that
    // mentions running "one `playwright test`" cannot be mistaken for a step.
    const testSteps = steps.filter((s) => /playwright test --project=/.test(s));
    expect(testSteps).toHaveLength(4);
    for (const s of testSteps) {
      const name = s.match(/name:\s*(.+)/)?.[1] ?? "(unnamed)";
      expect(s, `${name} has no PLAYWRIGHT_BASE_URL`).toContain(
        "PLAYWRIGHT_BASE_URL:",
      );
      expect(s, `${name} has no DEMO_PASSWORD`).toContain("DEMO_PASSWORD:");
    }
  });

  it("does not need a cleanup step — the e2e mutations clean up after themselves", () => {
    // This assertion is deliberately inverted from what it used to be.
    //
    // The job carried `node scripts/cleanup-leave-duplicates.mjs --apply` with
    // `if: always()`, justified as: "`mutations.spec.ts` submits a real
    // bereavement leave request, so every run leaves a duplicate behind."
    //
    // That stopped being true when the spec was fixed at the source — it now
    // picks a benign leave type by name (it used to select index 1, which
    // happened to be BEREAVEMENT) and deletes the row it created, scoped by row
    // ID. The workaround outlived its reason, so it would have kept running on
    // every build, kept needing privileged Supabase credentials in the job, and
    // kept deleting live demo data on a schedule nobody reasons about.
    //
    // Asserting its *absence* is what stops the band-aid being reinstated the
    // next time someone reads the old comment and believes it.
    const step = steps.find((s) => s.includes("cleanup-leave-duplicates"));
    expect(
      step,
      "e2e job still runs the leave-cleanup workaround; the source pollution was fixed",
    ).toBeUndefined();

    // And the thing that actually has to hold: the spec removes its own row.
    const mutations = readFileSync(
      join(process.cwd(), "e2e/mutations.spec.ts"),
      "utf8",
    );
    // Whitespace-tolerant so reformatting the spec cannot silently void this.
    expect(
      mutations,
      "mutations spec no longer deletes the row it created",
    ).toMatch(/from\("leave_requests"\)\s*\.delete\(\)\s*\.in\(\s*"id"/);
    // Deleting by reason string would take the seeded demo history with it —
    // that is exactly the bug that emptied the table once already.
    expect(mutations).not.toMatch(/\.delete\(\)\s*\.eq\(\s*"reason"/);
  });

  it("keeps the repair script usable in CI, where there is no .env.local", () => {
    const script = readFileSync(
      join(process.cwd(), "scripts/cleanup-leave-duplicates.mjs"),
      "utf8",
    );
    // Still shipped for when the table genuinely holds duplicates. It used to
    // throw on a missing .env.local, which is a hard failure in CI.
    expect(script).not.toMatch(/if \(!existsSync\("\.env\.local"\)\) throw/);
    expect(script).toContain("process.env[key]");
  });
});
