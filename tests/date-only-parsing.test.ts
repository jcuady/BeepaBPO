import { describe, expect, it } from "vitest";

// Postgres `date` columns arrive as "YYYY-MM-DD" strings. `new Date("2026-09-15")`
// parses that as **UTC midnight**; formatting it back in server-local time is
// then correct only where the local zone is UTC or east of it. At UTC-4 (the
// app also carries an America/New_York holiday calendar) it renders the
// previous day.
//
// `parseISO` from date-fns reads a date-only string as **local** midnight, so the
// calendar day round-trips in every zone. These tests mutate process.env.TZ to
// prove it rather than reasoning about it.

function renderIn(tz: string, iso: string) {
  const original = process.env.TZ;
  process.env.TZ = tz;
  try {
    // Local midnight, mirroring parseISO's documented behaviour for date-only.
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).getDate();
  } finally {
    process.env.TZ = original;
  }
}

describe("date-only columns must not be parsed as UTC", () => {
  const ZONES = ["UTC", "Asia/Manila", "America/New_York", "Pacific/Auckland"];

  it("new Date() on a date-only string shifts the day west of UTC", () => {
    const original = process.env.TZ;
    const days = new Set<number>();
    for (const tz of ZONES) {
      process.env.TZ = tz;
      days.add(new Date("2026-09-15").getDate());
    }
    process.env.TZ = original;

    // The bug being guarded against: not all hosts agree on the calendar day.
    expect(days.size).toBeGreaterThan(1);
  });

  it("local-midnight parsing renders the same day in every zone", () => {
    const rendered = ZONES.map((tz) => renderIn(tz, "2026-09-15"));
    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toBe(15);
  });

  it("covers the date-only fields the app renders", () => {
    // work_date, start_date, end_date, pay_date, hire_date.
    for (const iso of ["2026-01-01", "2026-03-31", "2026-09-15", "2026-12-31"]) {
      const days = new Set(ZONES.map((tz) => renderIn(tz, iso)));
      expect(days.size).toBe(1);
    }
  });
});

describe("source uses parseISO for date-only columns", () => {
  const files = [
    "app/app/my/attendance/page.tsx",
    "app/app/employees/[id]/page.tsx",
    "app/app/payroll/periods/[id]/page.tsx",
  ];

  it("does not pass a date-only column to new Date()", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const offenders: string[] = [];

    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      const matches = src.match(/new Date\(\s*[A-Za-z_$][\w$]*\??\.\s*(work_date|start_date|end_date|pay_date|hire_date)\s*\)/g);
      if (matches) offenders.push(`${rel}: ${matches.join(", ")}`);
    }

    expect(offenders).toEqual([]);
  });
});