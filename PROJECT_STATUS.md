# PROJECT_STATUS — Beepa / BeepoBeepa

**Updated:** 2026-09-07  
**Branch:** `main`  
**Overall:** **DEMO-HARDENED / PARTIAL product** — email/password auth is the intentional path.

## Health

| Area | Status |
|------|--------|
| Overall | PARTIAL — demo-ready for scripted paths |
| Frontend | GOOD |
| Backend | PARTIAL — email Auth + RLS + workflows |
| Database | GOOD |
| Testing | PASS — typecheck, lint, vitest (127), build |
| E2E | PASS prior slices |
| Documentation | GOOD |
| Deployment | LIVE at beepabpo.com |

## Auth (locked for now)

**Email/password only** on `/login`, `/signup`, `/employee/login` (+ forgot/reset). Social OAuth is **deferred** by product choice — no decoy provider buttons. `/auth/callback` remains for magic-link / future OAuth when explicitly enabled.

## Highest-value next action

**Ticket assignment UI** — `tickets.assigned_user_id` / team exist in schema; staff queue can update status but cannot assign an owner yet.

## Top PO backlog

1. Ticket assign (staff) — set assignee + show on queue/detail  
2. SLA policy admin — edit `ticket_sla_policies` (today seed/SQL only)  
3. Payroll period approval via workflow engine (`payroll` code already seeded)  
4. Social OAuth — **deferred** until providers are configured and product asks for it  

## Demo-safe promise

Sign-in is email + password (demo picker when `DEMO_PASSWORD` is set). No Google/Microsoft CTAs.
