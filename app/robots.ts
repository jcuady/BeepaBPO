import type { MetadataRoute } from "next";
import { PRODUCTION_SITE_URL, resolveSiteUrl } from "@/lib/site-url";

function seoOrigin(): string {
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
  const resolved = resolveSiteUrl();
  if (/localhost|127\.0\.0\.1/i.test(resolved)) return PRODUCTION_SITE_URL;
  return resolved;
}

export default function robots(): MetadataRoute.Robots {
  const origin = seoOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app",
          "/app/",
          "/api/",
          "/auth/",
          "/login",
          "/signup",
          "/employee",
          "/employee/",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/access-denied",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin.replace(/^https?:\/\//, ""),
  };
}
