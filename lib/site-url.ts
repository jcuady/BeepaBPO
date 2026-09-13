/**
 * Canonical public site origin for SEO, OG, emails, and sitemaps.
 * Never ship localhost / preview hosts as the production Search Console URL.
 */
export const PRODUCTION_SITE_URL = "https://beepabpo.com";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

function isVercelPreviewHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".vercel.app");
  } catch {
    return /\.vercel\.app/i.test(url);
  }
}

/**
 * Resolve the absolute site origin.
 * Production builds always prefer beepabpo.com when env is missing, local, or vercel.app.
 */
export function resolveSiteUrl(
  raw = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  const candidate = raw?.trim() ? stripTrailingSlash(raw.trim()) : "";
  const vercelEnv = process.env.VERCEL_ENV; // production | preview | development
  const isProdBuild =
    vercelEnv === "production" || process.env.NODE_ENV === "production";

  if (isProdBuild) {
    if (!candidate || isLocalhostUrl(candidate) || isVercelPreviewHost(candidate)) {
      return PRODUCTION_SITE_URL;
    }
    return candidate;
  }

  if (vercelEnv === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }

  if (candidate) return candidate;

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }

  return "http://localhost:3000";
}
