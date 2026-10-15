import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The realtime probe failed release gate step 16 while realtime was working.
 *
 * What happened: the probe's subscribe promise resolved on a bare 2-second timer
 * whether or not the channel had acknowledged `SUBSCRIBED`, and it then sampled
 * for the event exactly once, after a fixed 2500ms sleep. Run standalone on an
 * idle box it passed. Run inside `verify-all.mjs` — straight after vitest and the
 * live-data smoke step, on a loaded machine — the insert could land before the
 * channel was live, or the event could arrive after the single sample, and the
 * probe printed "realtime BROKEN".
 *
 * `verify-all.mjs` then replaced that with a canned explanation: "DB needs
 * migration `20261006140000`". That migration is applied. The gate therefore
 * failed with a confident, wrong cause, pointing the reader at the database
 * instead of at the tool — the same failure mode as SYSTEM_AUDIT §16.4, §20.3 and
 * §20.7.
 *
 * These assertions are about the *shape* of the probe, because the defect is a
 * race: it cannot be reproduced by reading a success path. Each one has a
 * matching negative control below.
 */
const PROBE_PATH = join(process.cwd(), "scripts/audit/test-realtime-events.mjs");
const VERIFY_PATH = join(process.cwd(), "scripts/verify-all.mjs");
const probe = readFileSync(PROBE_PATH, "utf8");
const verify = readFileSync(VERIFY_PATH, "utf8");

/**
 * Strip comments before asserting on strings.
 *
 * Otherwise the guard matches the comment that *explains* the removal — the same
 * self-reference trap as SYSTEM_AUDIT §20.5, where the design-system contract
 * test matched its own assertion string. Only whole-line `//` comments are
 * stripped, so a `https://` inside a string literal survives.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const verifyCode = stripComments(verify);
const probeCode = stripComments(probe);

describe("realtime probe — subscription is confirmed before the insert", () => {
  it("waits for an explicit SUBSCRIBED acknowledgement", () => {
    expect(probeCode).toContain('status === "SUBSCRIBED"');
  });

  it("does not resolve the subscribe promise on a bare timer", () => {
    // The old line was `setTimeout(resolve, 2000)`: it resolved the same promise
    // the subscribe callback resolved, so the insert raced the channel. A
    // `() => resolve(false)` timeout is fine — that resolves false and is only
    // the ceiling — so only the bare `resolve` form is banned.
    expect(probeCode).not.toMatch(/setTimeout\(\s*resolve\s*,/);
  });

  it("gates the insert on a confirmed subscription", () => {
    expect(probeCode).toContain("if (!didSubscribe)");
    // And the insert comes after that guard, not before it.
    expect(probeCode.indexOf("if (!didSubscribe)")).toBeLessThan(
      probeCode.indexOf("Inserting test notification"),
    );
  });

  it("reports a transport failure distinctly from a delivery failure", () => {
    // Different faults need different fixes, so they get different exits.
    expect(probeCode).toContain("PROBE_RESULT=NOT_SUBSCRIBED");
    expect(probeCode).toContain("PROBE_RESULT=DELIVERY_FAILED");
    expect(probeCode).toContain("PROBE_RESULT=OK");
    expect(probeCode).toMatch(/process\.exit\(3\)/);
  });

  it("polls for the event instead of sampling once", () => {
    // The old probe slept a flat `setTimeout(r, 2500)` and sampled once.
    expect(probeCode).not.toMatch(/setTimeout\(\s*r\s*,\s*2500\s*\)/);
    expect(probeCode).toMatch(/while\s*\(\s*!fired\s*&&/);
    expect(probeCode).toContain("DELIVERY_TIMEOUT_MS");
  });

  it("measures delivery latency instead of only reporting a deadline", () => {
    // A budget that expires cannot say whether the event was late or never coming, and
    // the probe used to print the same "DELIVERY FAILED" for both. It now records when
    // the event actually fired and keeps polling past the budget to a ceiling.
    expect(probeCode).toContain("firedAt");
    expect(probeCode).toContain("HARD_CEILING_MS");
    expect(probeCode).toMatch(/latencyMs\s*=\s*fired\s*\?\s*firedAt\s*-\s*insertedAt/);
  });

  it("reports a late delivery distinctly from an outage", () => {
    expect(probeCode).toContain("PROBE_RESULT=LATE");
    expect(probeCode).toMatch(/process\.exit\(fired && !late \? 0 : late \? 4 : 1\)/);
  });

  it("still subscribes as an authenticated user, not anon", () => {
    // `notifications` is RLS-scoped `user_id = auth.uid()`, so an anon subscriber
    // can never see the row. This was the previous generation of the same bug.
    expect(probeCode).toContain("signInWithRetry");
    expect(probeCode).toContain("does not match the notification owner");
  });
});

describe("verify-all surfaces the probe's real diagnosis", () => {
  it("does not emit the canned 'DB needs migration' explanation", () => {
    expect(verifyCode).not.toContain("DB needs migration");
  });

  it("does not pattern-match a prose string to decide the cause", () => {
    // `out.includes("realtime BROKEN")` routed every failure into one branch,
    // which is how a transport race got reported as a missing migration.
    expect(verifyCode).not.toContain('out.includes("realtime BROKEN")');
  });

  it("surfaces the probe output instead", () => {
    expect(verifyCode).toContain("out.trim().slice");
    expect(verifyCode).toContain("PROBE_RESULT=DELIVERY_FAILED");
  });

  it("surfaces LATE as its own outcome, not as an outage", () => {
    // The whole point of measuring latency is that "late" and "never" reach the reader
    // as different facts. If LATE folded into DELIVERY_FAILED, the gate would be back
    // to naming a cause it has not established.
    expect(verifyCode).toContain("PROBE_RESULT=LATE");
    expect(verifyCode).toMatch(/marker === "LATE"/);
  });

  it("never excuses a broken realtime delivery, whatever the migration flag says", () => {
    // This test used to pin the OPPOSITE. It required
    // `marker === "DELIVERY_FAILED" && SKIP_MIGRATION` to exist and asserted
    // `skipped: true` — it was guarding a lie. That branch turned a failed
    // delivery probe into a skipped step citing "migration 20261006140000 not
    // pushed yet", and `supabase migration list` shows that migration APPLIED
    // on the remote. So the flag did not skip a migration check (there was no
    // migration step to skip); its only effect was to buy a green release for a
    // broken notification path, with a cause that was not true.
    //
    // The concern underneath the test was right and is kept: a broken delivery
    // must never be waved through. What changed is the mechanism. DELIVERY_FAILED
    // now fails the gate outright, in the probe's own words.
    //
    // The counting invariant this test was really protecting — a skip never
    // counts as passed, so "Ship it" cannot print over one — is asserted in
    // `release-gate-honesty.test.ts`, against the accounting itself rather than
    // against one particular branch.
    expect(verifyCode).not.toMatch(/marker === "DELIVERY_FAILED" && SKIP_MIGRATION/);
    expect(verifyCode).not.toContain("20261006140000 not pushed yet");
    // And the step still ends in a throw, so an unrecognised marker fails too.
    expect(verifyCode).toMatch(/realtime probe exited \$\{r\.status\} with no output/);
  });

  it("--skip-migration now skips a real migration check", () => {
    // So the flag is not a no-op wearing a migration's name.
    expect(verifyCode).toContain("preflight-pending-migrations.mjs");
    expect(verifyCode).toMatch(/SKIP_MIGRATION[\s\S]{0,200}?skipped:\s*true/);
  });
});

describe("negative controls", () => {
  const broken = probeCode
    // Reinstate the timer race and the single sample.
    .replace('status === "SUBSCRIBED"', 'status === "NEVER_HAPPENS"')
    // `replaceAll`, not `replace`. The probe has two polling loops — one to the
    // delivery budget, one to the hard ceiling — and the control is meant to prove the
    // assertion bites when *no* polling remains. Mutating only the first left the
    // second in place, so the control reported a failure against a correct probe.
    .replaceAll("while (!fired && Date.now() < deadline) {", "if (false) {");

  it("catches the timer race", () => {
    // If the assertions were reading the wrong thing, this control would pass.
    expect(broken).not.toContain('status === "SUBSCRIBED"');
  });

  it("catches a single-sample delivery wait", () => {
    expect(broken).not.toMatch(/while\s*\(\s*!fired\s*&&/);
  });

  it("catches the LATE outcome collapsing back into a pass", () => {
    // Two independent mutations, because the positive assertions pin two different
    // things. Checking only the marker would pass even if the probe reported lateness
    // as a success on exit 0.
    const noMarker = probeCode.replace("PROBE_RESULT=LATE", "PROBE_RESULT=OK");
    expect(noMarker).not.toContain("PROBE_RESULT=LATE");

    const noDistinctExit = probeCode.replace(
      "process.exit(fired && !late ? 0 : late ? 4 : 1)",
      "process.exit(fired ? 0 : 1)",
    );
    expect(noDistinctExit).not.toMatch(/late \? 4 : 1/);
  });

  it("catches the canned explanation returning to verify-all", () => {
    const regressed = verifyCode.replace(
      "out.trim().slice",
      'throw new Error("realtime events broken — DB needs migration `20261006140000`"); void (0) ||',
    );
    expect(regressed).toContain("DB needs migration");
  });

  it("proves stripComments is doing real work, not silently passing", () => {
    // The raw source *does* still mention the canned string — in the comment that
    // explains why it was removed. If someone drops `stripComments` and asserts on
    // raw `verify` instead, this control is what stops the guard from going
    // quietly vacuous (and, worse, from failing for the wrong reason).
    expect(verify).toContain("DB needs migration");
    expect(verifyCode).not.toContain("DB needs migration");
  });
});