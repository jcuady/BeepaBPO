# System Audit

## Summary

- **Audit date:** 2026-09-08 (P2 remaining pass)
- **Branch:** `main`
- **Framework:** Next.js 16 App Router + React 19 + Supabase Auth/RLS
- **Live:** https://beepabpo.com · DB `nwvnawgxkzwiercllgmg`
- **Build status:** PASS (`pnpm build`, exit 0)
- **Test status:** PASS (`pnpm test` — 38 files, 149 tests)
- **Typecheck / lint:** PASS
- **OAuth:** Deferred (email/password only)
- **Decision:** Admin **orgs / workflows stay view-only** (no CRUD)

## Critical Issues

| Severity | Area | Issue | Status |
|----------|------|-------|--------|
| P0 | — | None | Clear |
| P1 | Leave / portal / marketing | Prior audit items | **Fixed** |
| P2 | Employee edit | Display-only HR detail | **Fixed** — `updateEmployee` + form |
| P2 | Admin users | Invite-only | **Fixed** — role change + revoke |
| P2 | Confirms | Recalculate / send-to-client | **Fixed** — `ConfirmDialog` |
| P2 | Ticket reply | Flag off still allowed reply | **Fixed** — server + client UI (staff bypass) |
| P2 | Orgs/workflows CRUD | Product decide | **Keep RO** (documented) |

## Functional Issues

| Page/Feature | Problem | Fix | Verified |
|--------------|---------|-----|----------|
| `/app/employees/[id]` | No edit | `EmployeeEditForm` + `employees.manage` | Seam test |
| `/app/admin/users` | No revoke/role | `AdminMembershipActions` + `system.manage` | Seam test |
| Payroll recalculate | No confirm | `ConfirmDialog` | Seam test |
| Send to client | No confirm | `ConfirmDialog` | Seam test |
| `postTicketMessage` | No portal flag | Hard-lock non-staff when `allow_ticketing=false` | Seam test |

## Missing / deferred

| Area | Priority | Notes |
|------|----------|-------|
| Real FTS search | P3 / DEF | Command palette stays nav-only |
| Announcements CMS | DEF | Notifications cover the need |
| Social OAuth | DEF | Email/password intentional |
| Form validation polish (docs upload, notif prefs, invoice schema drift) | P2 polish | Low risk; not blocking demos |
| Supabase leaked-password advisor | Ops | Dashboard toggle |
| `browserslist` via `@serwist/next` | Ops | `pnpm audit` high; bump when upstream patches |
| Browser console + viewport + full e2e | QA | Re-run before marketing launch |

## Tests Added or Updated

- `tests/principal-audit-p1.test.ts` — P1 seams
- `tests/principal-remaining-p2.test.ts` — confirms, reply lock, employee update, admin lifecycle

## Skill

Personal Cursor skill: `~/.cursor/skills/principal-remaining-work/SKILL.md`

## Full next-steps plan

1. Manual `ROLE_CHECKLIST` walk on live demo roles (HR edit, admin revoke, client ticketing off).
2. Ops: enable Auth leaked-password protection; watch Serwist/`browserslist` advisory.
3. Before marketing launch: `pnpm test:e2e` + viewport matrix + browser console.
4. Only if product asks: org/workflow CRUD, FTS, OAuth, announcements CMS.

## Final Verification

- [x] Production build passes
- [x] Type check passes
- [x] Lint passes
- [x] Automated tests pass (149)
- [x] Critical seams covered by unit/source tests
- [ ] Mobile / tablet / desktop matrix — NOT VERIFIED this pass
- [x] Branding honesty (prior P1)
- [x] Permissions on new mutations
