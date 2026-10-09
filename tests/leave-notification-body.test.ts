import { describe, expect, it } from "vitest";
import { buildLeaveDecisionNotificationBody, buildLeaveRequestNotificationBody } from "@/lib/leave/notification-body";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A team lead's notification inbox is the only place they learn a request is
 * waiting. The live table held 27 `leave.request` rows whose title AND body were
 * byte-identical — "A team member submitted a leave request for review." — so
 * every entry said the same thing and none of them said who or when.
 *
 * These tests pin the properties that make the notification actionable, not the
 * exact wording, so the copy can change without the test needing to change.
 */
describe("leave request notification body", () => {
  it("names the requester", () => {
    const body = buildLeaveRequestNotificationBody({
      requesterName: "Maria Santos",
      leaveTypeName: "Vacation",
      startDate: "2026-10-14",
      endDate: "2026-10-16",
    });
    expect(body).toContain("Maria Santos");
  });

  it("states the number of days", () => {
    const body = buildLeaveRequestNotificationBody({
      requesterName: "Maria Santos",
      leaveTypeName: "Vacation",
      startDate: "2026-10-14",
      endDate: "2026-10-16",
    });
    expect(body).toContain("3 days");
  });

  it("states the dates", () => {
    const body = buildLeaveRequestNotificationBody({
      requesterName: "Maria Santos",
      leaveTypeName: "Vacation",
      startDate: "2026-10-14",
      endDate: "2026-10-16",
    });
    expect(body).toMatch(/Oct 14/);
    expect(body).toMatch(/Oct 16/);
  });

  it("names the leave type when one is known", () => {
    const body = buildLeaveRequestNotificationBody({
      requesterName: "Maria Santos",
      leaveTypeName: "Sick Leave",
      startDate: "2026-10-14",
      endDate: "2026-10-14",
    });
    expect(body).toContain("Sick Leave");
  });

  it("still produces a usable sentence with no name and no type", () => {
    const body = buildLeaveRequestNotificationBody({
      requesterName: null,
      leaveTypeName: null,
      startDate: "2026-10-14",
      endDate: "2026-10-15",
    });
    expect(body).toContain("2 days");
    expect(body).toMatch(/Oct 14/);
    expect(body).not.toMatch(/undefined|null|NaN/);
  });

  it("counts an inclusive single-day request as 1 day, not 0", () => {
    const body = buildLeaveRequestNotificationBody({
      requesterName: "Ana Reyes",
      leaveTypeName: "Vacation",
      startDate: "2026-10-14",
      endDate: "2026-10-14",
    });
    expect(body).toContain("1 day");
    expect(body).not.toContain("1 days");
  });

  it("distinguishes two requests from the same person on different dates", () => {
    const a = buildLeaveRequestNotificationBody({
      requesterName: "Maria Santos",
      leaveTypeName: "Vacation",
      startDate: "2026-10-14",
      endDate: "2026-10-16",
    });
    const b = buildLeaveRequestNotificationBody({
      requesterName: "Maria Santos",
      leaveTypeName: "Vacation",
      startDate: "2026-11-02",
      endDate: "2026-11-02",
    });
    expect(a).not.toBe(b);
  });
});

describe("leave decision notification body", () => {
  it("reads as a sentence, with no orphaned full stop", () => {
    // Reusing the pending sentence and stripping its prefix produced
    // "Your 3 days of leave (Oct 30 – Nov 1). was approved by Demo HR." — a
    // fragment followed by a stray full stop. Caught by reading the live
    // notification, not by any test.
    const body = buildLeaveDecisionNotificationBody({
      startDate: "2026-10-30",
      endDate: "2026-11-01",
      leaveTypeName: "Bereavement Leave",
      approved: true,
      decidedBy: "Demo HR",
    });
    expect(body).not.toMatch(/\)\.\s+was/);
    expect(body).toMatch(/\)\s+was approved by Demo HR\.$/);
  });

  it("says which request, for how long, and who decided", () => {
    const body = buildLeaveDecisionNotificationBody({
      startDate: "2026-10-30",
      endDate: "2026-11-01",
      approved: true,
      decidedBy: "Demo HR",
    });
    expect(body).toContain("3 days");
    expect(body).toContain("Oct 30");
    expect(body).toContain("Nov 1");
    expect(body).toContain("Demo HR");
  });

  it("distinguishes approval from rejection", () => {
    const approved = buildLeaveDecisionNotificationBody({
      startDate: "2026-10-30", endDate: "2026-11-01", approved: true, decidedBy: "Demo HR",
    });
    const rejected = buildLeaveDecisionNotificationBody({
      startDate: "2026-10-30", endDate: "2026-11-01", approved: false, decidedBy: "Demo HR",
    });
    expect(approved).toContain("was approved");
    expect(rejected).toContain("was rejected");
    expect(approved).not.toBe(rejected);
  });

  it("survives a missing decider and a missing leave type", () => {
    const body = buildLeaveDecisionNotificationBody({
      startDate: "2026-10-30", endDate: "2026-10-30", approved: true, decidedBy: null,
    });
    expect(body).toContain("1 day");
    expect(body).toMatch(/was approved\.$/);
    expect(body).not.toMatch(/undefined|null|\sby\s\./);
  });
});

describe("the leave action actually uses it, and does not swallow failures", () => {
  const source = readFileSync(
    join(process.cwd(), "lib/leave/actions.ts"),
    "utf8",
  );

  it("calls the tested builder rather than inlining a string", () => {
    expect(source).toContain("buildLeaveRequestNotificationBody(");
  });

  it("no longer ships the one-size-fits-all body", () => {
    expect(source).not.toContain(
      "A team member submitted a leave request for review.",
    );
  });

  it("logs notification failures instead of swallowing them", () => {
    // `catch { // Non-blocking }` meant a manager could simply never be told,
    // with nothing in the logs to explain why. There were TWO: the pending
    // request path and the decision path. This assertion caught the second one
    // after the first was already fixed.
    expect(source).not.toMatch(/catch\s*\{\s*\/\/\s*Non-blocking\s*\}/);
    // Both paths, not just one.
    const logged = source.match(/console\.error\(\s*"\s*\[leave\][^"]*"/g) ?? [];
    expect(logged.length).toBeGreaterThanOrEqual(2);
  });

  it("names who decided and which request, not just the verdict", () => {
    // "Your leave request was approved." is true of every approval a user ever
    // receives, which is the same defect as the 27 identical pending rows.
    expect(source).not.toContain("Your leave request was approved.");
    expect(source).not.toContain("Your leave request was rejected.");
  });
});

describe("negative control", () => {
  it("the old fixed string would fail every actionable-property test", () => {
    // Proves the suite above is not vacuous: this is the literal text the live
    // table contained 27 times.
    const old = "A team member submitted a leave request for review.";
    expect(old).not.toContain("Maria Santos");
    expect(old).not.toContain("3 days");
    expect(old).not.toMatch(/Oct 14/);
    const two = [old, "A team member submitted a leave request for review."];
    expect(two[0]).toBe(two[1]);
  });
});