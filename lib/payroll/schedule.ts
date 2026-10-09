/** Philippine pay cutoffs in Asia/Manila. Fixed salary only — no tax or statutory. */

export type SalaryFrequency = "semi_monthly" | "monthly" | "weekly";

export type PayrollWindow = {
  frequency: SalaryFrequency;
  name: string;
  start_date: string;
  end_date: string;
  pay_date: string;
  /** Share of the monthly base paid on this run. */
  salaryFactor: number;
};

export const SALARY_FREQUENCIES: readonly {
  id: SalaryFrequency;
  label: string;
  detail: string;
}[] = [
  {
    id: "semi_monthly",
    label: "Semi-monthly",
    detail: "1–15 and 16–end. Payday is the cutoff date. Half of the monthly salary.",
  },
  {
    id: "monthly",
    label: "Monthly",
    detail: "Full calendar month. Payday is the last day. Full monthly salary.",
  },
  {
    id: "weekly",
    label: "Weekly",
    detail: "Monday–Sunday. Payday is Sunday. Monthly salary × 12 ÷ 52.",
  },
];

type Ymd = { y: number; m: number; d: number };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function iso(p: Ymd) {
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function lastDay(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addDays(p: Ymd, days: number): Ymd {
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function manilaDateParts(date: Date): Ymd {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [y, m, d] = formatted.split("-").map(Number);
  return { y, m, d };
}

function manilaWeekday(date: Date) {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
  }).format(date);
  return WEEKDAY[short] ?? 0;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function salaryFactorFor(frequency: SalaryFrequency) {
  if (frequency === "monthly") return 1;
  if (frequency === "weekly") return 12 / 52;
  return 0.5;
}

export function windowForFrequency(
  frequency: SalaryFrequency,
  now = new Date(),
): PayrollWindow {
  const today = manilaDateParts(now);
  const monthName = MONTHS[today.m - 1];

  if (frequency === "monthly") {
    const end = { y: today.y, m: today.m, d: lastDay(today.y, today.m) };
    const start = { y: today.y, m: today.m, d: 1 };
    return {
      frequency,
      name: `${monthName} ${today.y} monthly`,
      start_date: iso(start),
      end_date: iso(end),
      pay_date: iso(end),
      salaryFactor: salaryFactorFor(frequency),
    };
  }

  if (frequency === "weekly") {
    const back = (manilaWeekday(now) + 6) % 7;
    const start = addDays(today, -back);
    const end = addDays(start, 6);
    return {
      frequency,
      name: `Week of ${iso(start)}`,
      start_date: iso(start),
      end_date: iso(end),
      pay_date: iso(end),
      salaryFactor: salaryFactorFor(frequency),
    };
  }

  if (today.d <= 15) {
    const start = { y: today.y, m: today.m, d: 1 };
    const end = { y: today.y, m: today.m, d: 15 };
    return {
      frequency,
      name: `${monthName} 1–15, ${today.y}`,
      start_date: iso(start),
      end_date: iso(end),
      pay_date: iso(end),
      salaryFactor: salaryFactorFor(frequency),
    };
  }

  const end = { y: today.y, m: today.m, d: lastDay(today.y, today.m) };
  const start = { y: today.y, m: today.m, d: 16 };
  return {
    frequency,
    name: `${monthName} 16–${end.d}, ${today.y}`,
    start_date: iso(start),
    end_date: iso(end),
    pay_date: iso(end),
    salaryFactor: salaryFactorFor(frequency),
  };
}

export function periodsOverlap(
  a: { start_date: string; end_date: string },
  b: { start_date: string; end_date: string },
) {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

export function windowAlreadyRun(
  window: Pick<PayrollWindow, "start_date" | "end_date">,
  periods: readonly { start_date: string; end_date: string }[],
) {
  return periods.some((period) => periodsOverlap(window, period));
}

export function fixedPayAmount(monthlySalary: number, factor: number) {
  return Math.round(monthlySalary * factor * 100) / 100;
}
