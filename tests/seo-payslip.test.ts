import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSimplePdf, formatMoney } from "@/lib/payroll/payslip-pdf";

describe("favicon and SEO assets", () => {
  it("ships favicon.ico at app and public roots", () => {
    expect(existsSync(join(process.cwd(), "app/favicon.ico"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/favicon.ico"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/icon.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/apple-icon.png"))).toBe(true);
  });

  it("root metadata declares icons and openGraph", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("favicon.ico");
    expect(layout).toContain("openGraph");
    expect(layout).toContain("apple-icon.png");
  });
});

describe("payslip PDF seam", () => {
  it("builds a PDF buffer with header", () => {
    const pdf = buildSimplePdf("Beepa Payslip", ["Net pay: PHP 1.00"]);
    const text = Buffer.from(pdf).toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("%%EOF");
    expect(formatMoney(1234.5)).toContain("1,234.50");
  });

  it("exposes authenticated payslip route", () => {
    const route = readFileSync(
      join(process.cwd(), "app/app/my/payroll/[recordId]/payslip/route.ts"),
      "utf8",
    );
    expect(route).toContain("export async function GET");
    expect(route).toContain("application/pdf");
    expect(route).toContain("payroll.self");
  });
});
