import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCTION_SITE_URL,
  resolveSiteUrl,
} from "@/lib/site-url";

describe("site URL resolution for SEO", () => {
  it("maps localhost production env to beepabpo.com", () => {
    const prevVercel = process.env.VERCEL_ENV;
    const prevNode = process.env.NODE_ENV;
    process.env.VERCEL_ENV = "production";
    process.env.NODE_ENV = "production";
    expect(resolveSiteUrl("http://localhost:3005")).toBe(PRODUCTION_SITE_URL);
    expect(resolveSiteUrl("https://beepabpo.vercel.app")).toBe(
      PRODUCTION_SITE_URL,
    );
    expect(resolveSiteUrl("https://beepabpo.com")).toBe(PRODUCTION_SITE_URL);
    process.env.VERCEL_ENV = prevVercel;
    process.env.NODE_ENV = prevNode;
  });

  it("keeps explicit non-local URLs in non-production", () => {
    const prevVercel = process.env.VERCEL_ENV;
    delete process.env.VERCEL_ENV;
    expect(resolveSiteUrl("https://staging.example.com")).toBe(
      "https://staging.example.com",
    );
    process.env.VERCEL_ENV = prevVercel;
  });
});

describe("robots and sitemap Search Console readiness", () => {
  it("robots declares production sitemap host and blocks app/auth", () => {
    const robots = readFileSync(join(process.cwd(), "app/robots.ts"), "utf8");
    expect(robots).toContain("PRODUCTION_SITE_URL");
    expect(robots).toContain("/api/");
    expect(robots).toContain("/auth/");
    expect(robots).toContain("sitemap.xml");
  });

  it("sitemap uses anon client and production origin guard", () => {
    const sitemap = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf8");
    expect(sitemap).toContain("createAnonClient");
    expect(sitemap).toContain("PRODUCTION_SITE_URL");
    expect(sitemap).toContain("/why-beepa");
    expect(sitemap).not.toContain('from "@/lib/supabase/server"');
  });

  it("app shell is noindex", () => {
    const layout = readFileSync(join(process.cwd(), "app/app/layout.tsx"), "utf8");
    expect(layout).toContain("index: false");
  });

  it("career detail emits JobPosting JSON-LD", () => {
    const page = readFileSync(
      join(process.cwd(), "app/(marketing)/careers/[slug]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("jobPostingJsonLd");
    expect(page).toContain('canonical: `/careers/${slug}`');
  });
});
