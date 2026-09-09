import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSimplePdf, formatMoney } from "@/lib/payroll/payslip-pdf";
import { BRAND } from "@/lib/site";

describe("favicon and SEO assets", () => {
  it("ships favicon.ico derived from Assets/logo.png", () => {
    expect(existsSync(join(process.cwd(), "Assets/logo.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/favicon.ico"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/favicon.ico"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/icon.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/apple-icon.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/favicon-48.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/brand/icon-512.png"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "public/brand/logo-source.png"))).toBe(
      true,
    );

    const ico = readFileSync(join(process.cwd(), "public/favicon.ico"));
    // ICO magic: reserved(0) + type(1)
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
  });

  it("root metadata declares icons, openGraph, and BeepoBPO brand", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("favicon.ico");
    expect(layout).toContain("openGraph");
    expect(layout).toContain("apple-icon.png");
    expect(layout).toContain("favicon-48.png");
    expect(layout).toContain("GOOGLE_SITE_VERIFICATION");
    expect(layout).toContain("BRAND");
  });

  it("exposes Search Console–ready brand constants", () => {
    expect(BRAND.name).toBe("BeepoBPO");
    expect(BRAND.title.length).toBeLessThanOrEqual(60);
    expect(BRAND.description.length).toBeGreaterThan(110);
    expect(BRAND.description.length).toBeLessThanOrEqual(165);
    expect(BRAND.iconUrl).toContain("icon-512");
  });

  it("homepage wires Organization + WebSite JSON-LD", () => {
    const page = readFileSync(
      join(process.cwd(), "app/(marketing)/page.tsx"),
      "utf8",
    );
    expect(page).toContain("ProfessionalService");
    expect(page).toContain("WebSite");
    expect(page).toContain("FAQPage");
    expect(page).toContain("BRAND.title");
  });

  it("contact form captures UTM attribution fields", () => {
    const form = readFileSync(
      join(process.cwd(), "components/marketing/contact-form.tsx"),
      "utf8",
    );
    expect(form).toContain('name="utm_source"');
    expect(form).toContain('name="landing_page"');
    expect(form).toContain('name="referrer_url"');
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
