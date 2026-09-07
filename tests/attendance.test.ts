import { describe, expect, it } from "vitest";
import { formatWorkedMinutes, workedMinutes } from "@/lib/attendance/minutes";

describe("attendance overnight calc", () => {
  it("computes overnight worked minutes", () => {
    expect(workedMinutes(22, 0, 7, 0, true)).toBe(540);
  });

  it("computes same-day shift", () => {
    expect(workedMinutes(9, 0, 18, 0, false)).toBe(540);
  });

  it("formats hours and minutes", () => {
    expect(formatWorkedMinutes(540)).toBe("9h 0m");
    expect(formatWorkedMinutes(75)).toBe("1h 15m");
  });
});
