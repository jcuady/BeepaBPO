# Deployment

## Platforms

- **App**: Vercel (Next.js 16)
- **Data/Auth**: Supabase project `nwvnawgxkzwiercllgmg`

Set all variables from [ENVIRONMENT.md](./ENVIRONMENT.md) in the Vercel project. Add Auth redirect URLs:

- `{SITE_URL}/auth/callback`
- `{SITE_URL}/reset-password`

## Database

```bash
npx supabase link --project-ref nwvnawgxkzwiercllgmg --yes
pnpm db:push          # supabase db push --yes
pnpm db:types         # regenerate types/database.ts
```

Apply migrations before relying on new RLS/indexes (including `20260906001400_hardening.sql` and `20260907140000_documents_client_insert.sql`).

## Seed

```bash
pnpm create-owner -- owner@beepabpo.com "Owner Name"   # first real owner (optional)
pnpm seed:demo                                         # 13 demo users; needs DEMO_PASSWORD + service role
```

## Cron

Schedule a caller (Vercel Cron or external) against:

```http
POST /api/jobs/cron
Authorization: Bearer $CRON_SECRET
Content-Type: application/json

{"job":"all"}
```

Also accepts `x-cron-secret: $CRON_SECRET`. Jobs: `missing_clock_out`, `invoice_overdue`, or `all`.

Dry-run (no notifies / no invoice status writes):

```http
POST /api/jobs/cron
Authorization: Bearer $CRON_SECRET
{"job":"all","dryRun":true}
```

Local smoke: `pnpm smoke:cron` (reads `.env.local`, hits `SMOKE_BASE_URL` or `http://localhost:3000`). Admin UI: `/app/admin` → Ops smoke (dry-run + test push for `system.manage`).

Without `CRON_SECRET`, the HTTP endpoint returns 401.

## VAPID / push

Generate a VAPID key pair; set public + private + subject. Users enable push from **My → Notifications**. Subscribe/unsubscribe via `/api/push/*`.

## CI (`.github/workflows/ci.yml`)

**verify** (every PR/push to `main`):

1. `pnpm install`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test`
5. `pnpm build` (placeholder public Supabase env)

**e2e** (when `DEMO_PASSWORD` and publishable key secrets are set):

1. Install Playwright Chromium
2. `pnpm test:e2e` against linked demo data

## Post-deploy smoke

1. Owner employee login → `/app/dashboard`
2. Client login → `/app/client`
3. Applicant login → `/app/applicant`
4. Cron Bearer auth
5. Optional: push subscribe in a supporting browser
