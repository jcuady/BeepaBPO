import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  formatZonedTime,
  workDateFor,
  zonedWorkDateTime,
} from "../lib/attendance/zoned-time";

// Regression tests for the manual attendance-entry timezone bug.
//
// `combineLocal` used `new Date(`${workDate}T${hh}:00`)`, which parses in the
// *server's* zone. The same manager entry therefore stored a different instant
// on a UTC host than on a Manila one, and manual records disagreed with the
// instants `clock_event` writes in the same column.
//
// These assertions are about the returned UTC instant, so they hold no matter
// what timezone the test host or the production host runs in. That is the point:
// the old implementation's answer changed with the host, the new one does not.

describe("zonedWorkDateTime", () => {
  it("stores a Manila morning shift as the correct UTC instant", () => {
    // 08:00 in Asia/Manila (UTC+8) is 00:00 UTC on the same calendar day.
    expect(zonedWorkDateTime("2026-09-15", "08:00")).toBe("2026-09-15T00:00:00.000Z");
  });

  it("stores a Manila evening shift across no day boundary", () => {
    expect(zonedWorkDateTime("2026-09-15", "17:30")).toBe("2026-09-15T09:30:00.000Z");
  });

  it("is independent of the host timezone", () => {
    const original = process.env.TZ;
    const results = new Set<string>();
    for (const tz of ["UTC", "Asia/Manila", "America/New_York", "Pacific/Auckland"]) {
      process.env.TZ = tz;
      results.add(zonedWorkDateTime("2026-09-15", "08:00") ?? "null");
    }
    process.env.TZ = original;
    expect(results.size).toBe(1);
  });

  it("the old server-local parse really did vary by host timezone", () => {
    // Guards the test above from passing vacuously. If mutating process.env.TZ
    // ever stops affecting Date parsing, this fails and the independence test
    // above is no longer proving anything.
    const original = process.env.TZ;
    const old = new Set<string>();
    for (const tz of ["UTC", "Asia/Manila"]) {
      process.env.TZ = tz;
      old.add(new Date("2026-09-15T08:00:00").toISOString());
    }
    process.env.TZ = original;

    expect(old.size).toBe(2);
    expect([...old].sort()).toEqual(["2026-09-15T00:00:00.000Z", "2026-09-15T08:00:00.000Z"]);
  });

  it("honours a non-Manila employee timezone", () => {
    // 09:00 in New York (UTC-4 in September) is 13:00 UTC.
    expect(zonedWorkDateTime("2026-09-15", "09:00", "America/New_York")).toBe(
      "2026-09-15T13:00:00.000Z",
    );
  });

  it("round-trips through formatZonedTime", () => {
    const iso = zonedWorkDateTime("2026-09-15", "08:00");
    expect(formatZonedTime(iso)).toBe("8:00 AM");
  });

  it("accepts H:MM as well as HH:MM", () => {
    expect(zonedWorkDateTime("2026-09-15", "8:05")).toBe("2026-09-15T00:05:00.000Z");
  });

  it("tolerates seconds and whitespace from a time input", () => {
    expect(zonedWorkDateTime("2026-09-15", "08:00:00")).toBe("2026-09-15T00:00:00.000Z");
  });

  it("returns null for a missing time", () => {
    expect(zonedWorkDateTime("2026-09-15", undefined)).toBeNull();
    expect(zonedWorkDateTime("2026-09-15", "")).toBeNull();
  });

  it("returns null for malformed input instead of an Invalid Date", () => {
    expect(zonedWorkDateTime("not-a-date", "08:00")).toBeNull();
    expect(zonedWorkDateTime("2026-09-15", "99:99")).toBeNull();
    expect(zonedWorkDateTime("2026-09-15", "abc")).toBeNull();
  });

  it("defaults to Asia/Manila", () => {
    expect(DEFAULT_TIMEZONE).toBe("Asia/Manila");
  });
});

describe("formatZonedTime", () => {
  it("renders a UTC instant as Manila wall clock", () => {
    // 00:00 UTC is 08:00 in Manila. Rendering this in the host zone is exactly
    // the bug: a UTC production server showed it as 12:00 AM.
    expect(formatZonedTime("2026-09-15T00:00:00.000Z")).toBe("8:00 AM");
  });

  it("renders in the requested timezone", () => {
    expect(formatZonedTime("2026-09-15T13:00:00.000Z", "America/New_York")).toBe("9:00 AM");
  });

  it("degrades safely for missing or invalid input", () => {
    expect(formatZonedTime(null)).toBe("—");
    expect(formatZonedTime(undefined)).toBe("—");
    expect(formatZonedTime("")).toBe("—");
    expect(formatZonedTime("garbage")).toBe("—");
  });
});

/**
 * "Which work date does this instant fall on?" — the question `clock_event`
 * answers when it stamps `attendance_records.work_date`.
 *
 * Added after the attendance exercise computed "today" with
 * `toISOString().slice(0, 10)`, which is UTC. For eight hours a day in
 * Asia/Manila that is the previous day, and the exercise reported a working
 * Clock In as broken — then leaked the row it had caused, because cleanup
 * searched for the date it wrongly expected.
 *
 * The instants below are the real ones from that run.
 */
describe("workDateFor", () => {
  it("agrees with clock_event on a mid-morning instant", () => {
    // 09:10 Manila on the 8th — the demo's usual working day.
    expect(workDateFor("2026-10-08T01:10:00.000Z", "Asia/Manila")).toBe("2026-10-08");
  });

  it("returns the Manila date when UTC still says the day before", () => {
    // The exact moment the audit ran: 02:02 Manila is 18:02 UTC the day before.
    // `toISOString().slice(0, 10)` said 2026-10-16; the database wrote 2026-10-17.
    const iso = "2026-10-16T18:02:00.000Z";
    expect(iso.slice(0, 10)).toBe("2026-10-16");
    expect(workDateFor(iso, "Asia/Manila")).toBe("2026-10-17");
  });

  it("holds in both directions around the UTC midnight hour", () => {
    // Not a one-directional fudge: just before 08:00 Manila the UTC date is still
    // behind, and just after, Manila is a full day ahead of New York.
    expect(workDateFor("2026-10-16T16:30:00.000Z", "Asia/Manila")).toBe("2026-10-17");
    expect(workDateFor("2026-10-16T23:59:00.000Z", "Asia/Manila")).toBe("2026-10-17");
    expect(workDateFor("2026-10-16T23:59:00.000Z", "America/Los_Angeles")).toBe("2026-10-16");
  });

  it("defaults to the project's timezone, the one clock_event falls back to", () => {
    expect(DEFAULT_TIMEZONE).toBe("Asia/Manila");
    expect(workDateFor("2026-10-16T18:02:00.000Z")).toBe(
      workDateFor("2026-10-16T18:02:00.000Z", DEFAULT_TIMEZONE),
    );
  });

  it("returns YYYY-MM-DD, the shape work_date is compared as", () => {
    expect(workDateFor("2026-01-05T00:00:00.000Z", "Asia/Manila")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});