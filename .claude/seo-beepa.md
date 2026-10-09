# Beepa / BeepoBPO — Claude SEO project context

Use this file whenever Claude SEO or Cursor runs SEO work inside this repo.

## Canonical site

| Field | Value |
|-------|-------|
| Production URL | `https://beepabpo.com` |
| Brand (SERP) | BeepoBPO |
| Display name | Beepa |
| Legal name | Beepa BPO |
| Tagline | People. Process. Progress. |
| Contact | hello@beepabpo.com |
| Industry | BPO / outsourcing (people-first support, ops, talent) |

Source of truth: `lib/site.ts`, `lib/site-url.ts` (`PRODUCTION_SITE_URL`).

## Primary pages to audit

- `/` home
- `/services` (+ service anchors)
- `/why-beepa`
- `/careers`
- `/resources`
- `/about`
- `/contact`

Sitemap: `app/sitemap.ts`. JSON-LD: `lib/seo/`.

## Default commands

```text
/seo audit https://beepabpo.com
/seo page https://beepabpo.com
/seo schema https://beepabpo.com
/seo geo https://beepabpo.com
/seo technical https://beepabpo.com
/seo content https://beepabpo.com
/seo sitemap https://beepabpo.com
```

From PowerShell (Cursor / scripts):

```powershell
& "$env:USERPROFILE\.claude\skills\seo\scripts\claude-seo.cmd" doctor --json
& "$env:USERPROFILE\.claude\skills\seo\scripts\claude-seo.cmd" run fetch_page.py https://beepabpo.com
```

## Implementation rules for this repo

- Prefer surgical fixes in existing marketing/SEO modules. No full redesign unless asked.
- Keep Beepa navy/green tokens and brand copy; do not invent fake metrics or client logos.
- After SEO code changes, verify with `pnpm typecheck` / relevant tests when the change touches TS.
- Localhost and `*.vercel.app` must never be treated as the Search Console production URL.

## Optional credentials (not required for core audits)

Store outside git. Claude SEO can use them when present:

- Google Search Console / PageSpeed / CrUX / GA4 → `/seo google`
- DataForSEO, Ahrefs, Firecrawl, Matomo → matching `/seo …` extension skills

## Reinstall / update

```powershell
git clone --depth 1 --branch v2.4.0 https://github.com/AgriciDaniel/claude-seo.git $env:TEMP\claude-seo
powershell -ExecutionPolicy Bypass -File $env:TEMP\claude-seo\install.ps1
```

Then re-apply the Windows Chrome fallback if needed (`scripts/playwright_browser.py`) when the Playwright CDN is unreachable.
