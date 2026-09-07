# Beepa BPO Platform

People. Process. Progress.

Unified BPO operating system: marketing site, employee HRIS, attendance, leave, payroll, ATS, CRM, client portal, ticketing, billing, PWA, and push notifications — all on `beepabpo.com` with Supabase.

## Prerequisites

- Node.js 20+
- pnpm 11+
- Supabase project (linked): `nwvnawgxkzwiercllgmg`

## Environment

Copy `.env.example` to `.env.local` and fill secrets:

```bash
cp .env.example .env.local
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` (server only)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
- `CRON_SECRET`
- `DEMO_PASSWORD` (dev seed only)

## Local development

```bash
pnpm install
pnpm dev
```

App: http://localhost:3000 (or the port Next prints)

## Database

```bash
# Link (once)
npx supabase link --project-ref nwvnawgxkzwiercllgmg --yes

# Push migrations
npx supabase db push --yes

# Regenerate types
pnpm db:types
```

## Bootstrap & seed

```bash
pnpm create-owner -- owner@beepabpo.com "Owner Name"
pnpm seed:demo
```

Demo password comes from `DEMO_PASSWORD`. On `/login` and `/employee/login` (dev, or `ALLOW_DEMO_LOGIN=true`), click any demo role to autofill email + password, then Sign In. Seed with `pnpm seed:demo` so Supabase Auth passwords stay synced.

Demo emails:

- `owner@demo.beepabpo.com` … `employee@demo.beepabpo.com` → `/employee/login`
- `clientadmin@demo.beepabpo.com` / `clientviewer@demo.beepabpo.com` / `applicant@demo.beepabpo.com` → `/login`

## Auth routes

| Route | Audience |
|-------|----------|
| `/login` | Clients & applicants (general) |
| `/signup` | Public applicant accounts |
| `/employee/login` | Internal Beepa staff only |
| `/app` | Authenticated workspace |

## Tests

```bash
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm build
```

E2E needs `DEMO_PASSWORD` and seeded demo users. See [docs/TESTING.md](docs/TESTING.md).

## App access

Authenticated `/app` uses segment layouts to keep trees separate:

- `/app/my/*` — internal membership only
- `/app/client/*` — client membership only
- `/app/applicant/*` — applicant-only membership

## PWA / Push

- Manifest: `/manifest.webmanifest`
- Service worker: `/sw.js` (registered in app shell)
- Enable push from **My → Notifications** after signing in
- Cron jobs: `POST /api/jobs/cron` with `Authorization: Bearer $CRON_SECRET`

## Documentation

Full index: [docs/README.md](docs/README.md)

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [ROLES_AND_PAGES.md](docs/ROLES_AND_PAGES.md)
- [ROUTES.md](docs/ROUTES.md)
- [PERMISSIONS.md](docs/PERMISSIONS.md)
- [DATABASE.md](docs/DATABASE.md)
- [WORKFLOWS.md](docs/WORKFLOWS.md)
- [SECURITY.md](docs/SECURITY.md)
- [ENVIRONMENT.md](docs/ENVIRONMENT.md)
- [DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- [TESTING.md](docs/TESTING.md)
- [QA_CHECKLIST.md](docs/QA_CHECKLIST.md)
- [CHANGELOG.md](docs/CHANGELOG.md)

## Deploy

Vercel + Supabase. Set all env vars in the Vercel project. Add Auth redirect URLs:

- `{SITE_URL}/auth/callback`
- `{SITE_URL}/reset-password`

## Troubleshooting

- Employee login rejects client accounts by design — use `/login`.
- Empty employee home: run `pnpm seed:demo` so `employees` rows exist.
- Push not firing: confirm VAPID keys and that the browser granted notification permission.
