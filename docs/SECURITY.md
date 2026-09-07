# Security

## Auth

- Supabase Auth is the only credential store
- Public signup cannot self-assign privileged roles
- Employee login requires active internal membership
- Login/signup UI is **email/password only** (intentional). Social OAuth deferred — no Google/Microsoft CTAs until product enables providers
- Admin invite (`system.manage`) uses service-role `inviteUserByEmail`; owner/super_admin roles are not selectable from the invite form
- Sessions refreshed in `proxy.ts`
- Segment layouts gate `/app/my` (internal), `/app/client` (client), `/app/applicant` (applicant-only)
- Post-login / callback `next` paths go through `safeNext` (`lib/auth/safe-next.ts`) — only same-origin relative paths; open redirects fall back to `/app`

## Secrets

- Never prefix service/secret keys with `NEXT_PUBLIC_`
- VAPID private key and `CRON_SECRET` are server-only
- Rotate `SUPABASE_ACCESS_TOKEN` after local use

## RLS

- Enabled on all user-accessible tables
- Helpers use `security definer` with fixed `search_path`
- Policies use `(select auth.uid())` for initplan performance
- Clients never see payroll compensation
- `ticket_internal_notes` restricted to `is_internal_user()`

## Storage

- Private buckets with path-scoped policies (`employee-documents`, `client-documents`, …)
- App signs downloads with the **user** JWT via `createSignedUrl` after `documents` SELECT succeeds (no service-role signing)
- Upload: employee self / `employees.documents.manage`; client via `can_access_client` + migration `20260907140000_documents_client_insert`
- TTL: 15 minutes; optional `download` filename on signed URL

## Payslips

- PDF streamed from authenticated route after `payroll_records` RLS + status gate (no public Storage URL)
- Self requires `payroll.self`; others need `payroll.read` / `payroll.manage`

## Headers

CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` set in `next.config.ts`.

## Audit

Sensitive mutations call `logAudit` (`lib/audit/log.ts`) and insert into `audit_logs`.
Insert RLS: `actor_user_id = (select auth.uid())` (see `20260906001400_hardening.sql`).
Normal users cannot update/delete audit rows; Owner/Super Admin read via `/app/admin/audit` (`system.manage`).

## Incident checklist

1. Revoke compromised sessions / rotate keys
2. Review `audit_logs`
3. Pause cron if abuse suspected
4. Restore from Supabase backup if needed
