# Architecture

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 App Router (`next@16.3.4`) |
| UI | React 19, Tailwind CSS 4, shadcn **base-nova** (`components.json`) |
| Auth / DB | Supabase Auth, Postgres, Row Level Security |
| Tests | Vitest (`tests/*.test.ts`), Playwright (`e2e/`) |
| PWA | Serwist service worker + `app/manifest.ts` |
| Push | Web Push (VAPID) via `/api/push/*` |

## Folder map

```
app/
  (marketing)/     Public site
  (auth)/          /login, /employee/login, signup, password, verify
  auth/callback/   OAuth / magic-link exchange
  app/             Authenticated workspace (+ my|client|applicant layouts)
  api/             Cron + push endpoints
components/
  app/             Shell, nav, domain forms
  ui/              shadcn primitives
  marketing/       Marketing sections
lib/
  auth/            resolveWorkspace, safeNext, landing, actions
  permissions/     can / codes
  */actions.ts     Server mutations (leave, attendance, NTE, …)
supabase/migrations/  Schema, RLS, seeds
tests/             Vitest
e2e/               Playwright
```

## Request flow

```mermaid
sequenceDiagram
  participant Browser
  participant Proxy as proxy.ts
  participant Layout as app/app/layout
  participant Segment as my|client|applicant layout
  participant Page
  participant RLS as Postgres RLS

  Browser->>Proxy: /app/*
  Proxy->>Proxy: updateSession (refresh cookies)
  alt no session
    Proxy-->>Browser: redirect /login?next=…
  end
  Proxy->>Layout: continue
  Layout->>Layout: resolveWorkspace (React cache)
  Layout->>Layout: AppShell + unread notifications
  Layout->>Segment: children
  Segment->>Segment: isInternal / isClient / isApplicantOnly
  alt wrong membership
    Segment-->>Browser: redirect /app
  end
  Segment->>Page: render
  Page->>RLS: queries / RPCs as auth.uid()
  Note over Page: requirePermission → forbidden()
```

## Auth model

1. **Membership type** on `organization_memberships`: `internal` | `client` | `applicant`.
2. **Flags** (`lib/auth/workspace-flags.ts`): `isInternal`, `isClient`, `isApplicantOnly`.
3. **Permissions**: RPC `user_permission_codes()` → `Set` on workspace; UI/actions use `can()` / `requirePermission()`.
4. **Landing** (`landingPathFor`): applicant → `/app/applicant`; `system.manage` → `/app/dashboard`; else internal → `/app/my`; client → `/app/client`.
5. **Employee login** (`/employee/login`) rejects client/applicant accounts; general `/login` for those audiences.

## Data flow

| Layer | Role |
|-------|------|
| Table / view | Source of truth under RLS |
| Server action (`lib/*/actions.ts`) | Validate, mutate, optional `logAudit`, `revalidatePath` |
| Page (`app/app/**/page.tsx`) | `resolveWorkspace`, gate, query, render |

Example: leave request → `leave_requests` + `approval_requests` (hardcoded workflow id) → `/app/my/leave` and `/app/leave` revalidated.

## Deepening opportunities / product backlog (not built yet)

Documented for honesty — do not treat as shipped:

- **CMS admin** — `/app/cms` covers About (`public_about`), FAQs, services, blog, **industries**, **testimonials**, **case studies** (create + publish/archive). Public: `/about`, `/contact`, `/services`, `/resources`, `/case-studies`(+`/[slug]`). Edit-in-place for existing rows still thin.
- **Dynamic approval workflows** — seeded rows; mutations use hardcoded IDs in `lib/constants/approvals.ts`.
- **Client SLA metric** — removed from dashboard until data exists.
- **CRM depth** — leads + deals pipeline + **proposals** (create/status) shipped; deal→client org convert shipped. **Client portal invite** shipped (`/app/clients`).
- **Google / Microsoft OAuth** — provider buttons **removed** from login/signup until Supabase providers are configured; email/password only. `/auth/callback` still exchanges codes for future OAuth.
- **Email digests** — cron `notification_digest` emails unread in-app notifications via Resend when `RESEND_API_KEY` is set; users opt out with Email digests on `/app/my/notifications`.

Shipped recently (see PROJECT_STATUS): … client-org invite, **remaining CMS page types**.

See [TEST_PLAN.md](./TEST_PLAN.md) §9.