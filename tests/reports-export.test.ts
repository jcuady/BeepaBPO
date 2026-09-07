import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { csvEscape, isReportDataset, rowsToCsv } from "@/lib/reports/csv";

describe("reports CSV helpers", () => {
  it("escapes commas quotes and newlines", () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line\n2")).toBe('"line\n2"');
    expect(csvEscape(null)).toBe("");
  });

  it("builds CRLF CSV with header row", () => {
    const csv = rowsToCsv(
      ["name", "count"],
      [
        ["Acme, Inc", 2],
        ["Beta", null],
      ],
    );
    expect(csv).toBe('name,count\r\n"Acme, Inc",2\r\nBeta,\r\n');
  });

  it("validates dataset names", () => {
    expect(isReportDataset("snapshot")).toBe(true);
    expect(isReportDataset("leads")).toBe(true);
    expect(isReportDataset("payroll")).toBe(false);
  });
});

describe("reports export route wiring", () => {
  const route = readFileSync(
    join(process.cwd(), "app/app/reports/export/route.ts"),
    "utf8",
  );
  const page = readFileSync(
    join(process.cwd(), "lib/app/admin-pages.tsx"),
    "utf8",
  );

  it("gates GET export on reports.export", () => {
    expect(route).toContain('can(workspace.permissions, "reports.export")');
    expect(route).toContain("text/csv");
    expect(route).toContain("Content-Disposition");
  });

  it("shows export links only when canExport", () => {
    expect(page).toContain('workspace.permissions.has("reports.export")');
    expect(page).toContain("/app/reports/export?dataset=");
    expect(page).toContain("CSV export");
  });
});
