/** Escape one CSV field (RFC 4180-ish). */
export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV document from headers + row cells. */
export function rowsToCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export const REPORT_DATASETS = [
  "snapshot",
  "employees",
  "attendance",
  "tickets",
  "leads",
] as const;

export type ReportDataset = (typeof REPORT_DATASETS)[number];

export function isReportDataset(value: string): value is ReportDataset {
  return (REPORT_DATASETS as readonly string[]).includes(value);
}
