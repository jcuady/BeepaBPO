import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  PRODUCTION_SITE_URL,
  resolveSiteUrl,
} from "@/lib/site-url";

describe("site URL resolution for SEO", () => {
  it("maps localhost production env to beepabpo.com", () => {
    const prevVercel = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    expect(resolveSiteUrl("http://localhost:3005")).toBe(PRODUCTION_SITE_URL);
    expect(resolveSiteUrl("https://beepabpo.vercel.app")).toBe(
      PRODUCTION_SITE_URL,
    );
    expect(resolveSiteUrl("https://beepabpo.com")).toBe(PRODUCTION_SITE_URL);
    process.env.VERCEL_ENV = prevVercel;
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

    // This used to assert the literal text `canonical: \`/careers/${slug}\``,
    // which only held while the page built its metadata by hand. The canonical
    // is unchanged — it is now emitted by `pageMetadata()`, and
    // `audit:seo` asserts the rendered tag per URL — so a source-text assertion
    // here was pinning the implementation rather than the requirement, and
    // would fail any correct refactor.
    //
    // What actually matters is the chain: the slug must reach the canonical, and
    // the helper must turn `path` into one. Assert both halves so neither can
    // be dropped silently.
    expect(page).toContain("path: `/careers/${slug}`");

    const helper = readFileSync(join(process.cwd(), "lib/seo/metadata.ts"), "utf8");
    expect(helper).toContain("alternates: { canonical: path }");
  });

  it("no page hand-rolls a partial openGraph block", () => {
    // The root cause of every missing og:image on this site: Next.js REPLACES
    // nested metadata objects instead of merging them, so a page declaring
    // `openGraph: { title, description }` silently drops the root's url and
    // images. `pageMetadata()` cannot express a partial block, which is the
    // point of it — so forbid the pattern outright.
    const out = execFileSync("git", ["ls-files", "app"], { encoding: "utf8" });
    const offenders: string[] = [];
    for (const file of out.split("\n").filter(Boolean).filter((f) => f.endsWith(".tsx"))) {
      // The root layout is the source of the complete Open Graph block, not a
      // consumer of it. Exempt it, or this rule bans the very thing it protects.
      if (file === "app/layout.tsx") continue;
      const src = readFileSync(join(process.cwd(), file), "utf8");
      // Strip comments so the explanatory notes above each site do not trip this.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      if (/openGraph:\s*\{/.test(code) && !code.includes("pageMetadata")) offenders.push(file);
    }
    expect(
      offenders,
      `These pages declare a partial openGraph and will drop the root's url/images:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("ships Google Organization logo on white for Knowledge Panel", () => {
    const logo = join(
      process.cwd(),
      "public/brand/google-organization-logo.png",
    );
    expect(existsSync(logo)).toBe(true);
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("favicon-48.png");
    expect(layout).toContain("favicon-96.png");
  });
});
