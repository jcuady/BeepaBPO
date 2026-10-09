import { describe, expect, it } from "vitest";
import {
  fixedPayAmount,
  periodsOverlap,
  windowAlreadyRun,
  windowForFrequency,
} from "../lib/payroll/schedule";

const tuesday = new Date("2026-09-22T04:00:00.000Z");

describe("Philippine payroll windows", () => {
  it("uses the second semi-monthly cutoff after the 15th", () => {
    const window = windowForFrequency("semi_monthly", tuesday);
    expect(window).toMatchObject({
      start_date: "2026-09-16",
      end_date: "2026-09-30",
      pay_date: "2026-09-30",
      salaryFactor: 0.5,
    });
  });

  it("uses the first semi-monthly cutoff on the 15th", () => {
    const window = windowForFrequency(
      "semi_monthly",
      new Date("2026-09-15T04:00:00.000Z"),
    );
    expect(window.start_date).toBe("2026-09-01");
    expect(window.end_date).toBe("2026-09-15");
    expect(window.pay_date).toBe("2026-09-15");
  });

  it("uses a full calendar month", () => {
    const window = windowForFrequency("monthly", tuesday);
    expect(window).toMatchObject({
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      pay_date: "2026-09-30",
      salaryFactor: 1,
    });
  });

  it("uses Monday–Sunday weeks", () => {
    const window = windowForFrequency("weekly", tuesday);
    expect(window.start_date).toBe("2026-09-21");
    expect(window.end_date).toBe("2026-09-27");
    expect(window.pay_date).toBe("2026-09-27");
  });

  it("blocks a run that already covers the window", () => {
    const window = windowForFrequency("semi_monthly", tuesday);
    expect(
      windowAlreadyRun(window, [
        { start_date: "2026-09-16", end_date: "2026-09-30" },
      ]),
    ).toBe(true);
    expect(
      windowAlreadyRun(window, [
        { start_date: "2026-09-01", end_date: "2026-09-15" },
      ]),
    ).toBe(false);
  });

  it("pays a fixed slice with no statutory deduction", () => {
    expect(fixedPayAmount(28450, 0.5)).toBe(14225);
    expect(fixedPayAmount(28450, 1)).toBe(28450);
  });
});

describe("overlap semantics match the database exclusion constraint", () => {
  // payroll_periods_no_overlap uses daterange(start_date, end_date, '[]'), i.e.
  // inclusive on both ends. If periodsOverlap ever diverges from that, the app
  // would accept a cutoff the database then rejects, or worse, silently allow
  // the double payment the constraint exists to prevent.
  const septemberFirst = { start_date: "2026-09-01", end_date: "2026-09-15" };

  it("rejects a run that shares a single day with an existing period", () => {
    // A run ending on the 15th and another starting on the 15th both pay the
    // 15th. That must be refused.
    expect(
      periodsOverlap(septemberFirst, { start_date: "2026-09-15", end_date: "2026-09-30" }),
    ).toBe(true);
    expect(
      windowAlreadyRun(septemberFirst, [{ start_date: "2026-09-15", end_date: "2026-09-30" }]),
    ).toBe(true);
  });

  it("allows genuinely adjacent runs", () => {
    // The intended semi-monthly split: 1–15 then 16–30 share no day.
    expect(
      periodsOverlap(septemberFirst, { start_date: "2026-09-16", end_date: "2026-09-30" }),
    ).toBe(false);
    expect(
      windowAlreadyRun(septemberFirst, [{ start_date: "2026-09-16", end_date: "2026-09-30" }]),
    ).toBe(false);
  });

  it("rejects a full-month run that swallows a finalized cutoff", () => {
    // The exact shape found live in the database: a finalized 1–15 run plus a
    // draft 1–30 run, which pays the first half twice.
    expect(
      periodsOverlap(septemberFirst, { start_date: "2026-09-01", end_date: "2026-09-30" }),
    ).toBe(true);
  });

  it("treats an identical period as an overlap", () => {
    expect(periodsOverlap(septemberFirst, { ...septemberFirst })).toBe(true);
  });
});
