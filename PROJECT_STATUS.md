# PROJECT_STATUS — Beepa / BeepoBeepa

**Updated:** 2026-09-08  
**Branch:** `main`  
**Overall:** **DEMO-HARDENED / PARTIAL product** — CI workflow fixed; account Settings/notifications honesty gaps closed.

## Health

| Area | Status |
|------|--------|
| Overall | PARTIAL — demo-ready for scripted paths |
| Frontend | GOOD — Settings, notifications, gated client ticket CTAs |
| Backend | PARTIAL — payroll + approvals wired |
| Database | GOOD |
| Testing | PASS — typecheck/lint/test/build exit 0 |
| E2E | Optional via `vars.RUN_E2E=true` + secrets |
| Documentation | GOOD |
| Deployment | LIVE at beepabpo.com |
| CI | Fixed — prior runs failed at parse (unquoted `AUTH_SECRET!!` + `secrets.*` in `if`) |

## Auth (locked for now)

**Email/password only** (simple Supabase Auth). Social OAuth deferred — no decoy buttons. Change password on `/app/my/settings`, client settings, applicant profile.

## Highest-value next action

Optional polish (client portal flags enforcement) or new PO asks. OAuth remains deferred.

## Top PO backlog

1. Social OAuth — deferred  
2. Optional: enforce client portal flags (`allow_ticketing`, etc.) in nav/pages  
3. Optional: announcements CMS for employee dashboard  

## Demo-safe promise

Finance submits payroll periods; Finance → Owner approve via seeded workflow. Staff Settings changes password. Client Viewer no longer sees Create/Reply ticket affordances they cannot use. Sign-in remains email/password.
