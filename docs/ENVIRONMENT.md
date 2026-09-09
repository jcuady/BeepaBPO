# Environment

Copy `.env.example` → `.env.local`. Validation lives in `lib/env.ts` (subset required at runtime).

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (emails, redirects, metadata). Default `https://beepabpo.com`. |
| `GOOGLE_SITE_VERIFICATION` | Optional Google Search Console HTML-tag token (content value only). Emitted as `verification.google` in root metadata when set. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server anon-style publishable key (preferred). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Alternate anon JWT key; used if publishable key unset (`getPublicSupabaseKey`). |
| `SUPABASE_SECRET_KEY` | Server-only secret key (admin client). |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternate service-role key; either this or `SUPABASE_SECRET_KEY` required for admin/seed. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key (client subscribe). |
| `VAPID_PRIVATE_KEY` | Web Push private key (server send). Server only. |
| `VAPID_SUBJECT` | Push contact URI, e.g. `mailto:admin@beepabpo.com`. |
| `CRON_SECRET` | Bearer token for `POST /api/jobs/cron`. Server only. |
| `DEMO_PASSWORD` | Shared password for `pnpm seed:demo` users, Playwright, and login autofill picker (dev only unless `ALLOW_DEMO_LOGIN`). |
| `ALLOW_DEMO_LOGIN` | Set `true` to show demo autofill on production builds (staging/preview only). Never enable on public prod without intent. |
| `PLAYWRIGHT_BASE_URL` | Optional e2e base (default localhost from Playwright config). |
| `RESEND_API_KEY` | Optional transactional email via Resend (required for notification digests). |
| `EMAIL_FROM` | Optional From header, e.g. `Beepa <no-reply@beepabpo.com>`. Defaults to Resend onboarding sender when unset. |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional client Sentry DSN (listed in `.env.example`; wire when enabling Sentry). |
| `SENTRY_AUTH_TOKEN` | Optional Sentry upload/auth token. |

## Rules

- Never prefix `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, or `CRON_SECRET` with `NEXT_PUBLIC_`.
- CI build uses placeholder public keys; e2e job needs real secrets + `DEMO_PASSWORD`.
