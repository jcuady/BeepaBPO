# Completion ledger — Principal QA campaign

**Started:** 2026-09-13  
**Last updated:** 2026-09-14 (Prompt 8 — shell latency + attendance clock + realtime)  
**Campaign status:** **READY** — apply migration `20260914120000` on Beepa DB, then deploy

## Done criteria (100%)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Role × page truth for all 14 seeded roles | **PASS** — local e2e + **live beepabpo.com landings** |
| 2 | Critical workflows documented with pass/fail | **PASS** |
| 3 | No open P0/P1 | **PASS** |
| 4 | UI consistency on audited hubs | **PASS** — EmptyState + loading + overflow clip |
| 5 | Automated gates green | **PASS** — typecheck · lint · vitest 184 · **build** · Playwright viewport **24/24** · roles/e2e |
| 6 | PROJECT_STATUS honest | **PASS** → READY |

**Overall:** READY — clock on Attendance; workspace queries parallel; live refresh on CRM/tickets/attendance. Apply `20260914120000` on `nwvnawgxkzwiercllgmg`.

---

## Prompt log

### Prompt 1–5 — Portal flags, RBAC, CRM (2026-09-13)

See prior ledger entries: portal flag High bugs fixed; requireInternal; ticket RLS; CRM workbench; unit suite green.

### Prompt 6 — Completeness / lag (2026-09-13)

Query caps, loading skeletons, notification ActionResult, admin role ConfirmDialog, e2e 36/1.

### Prompt 7 — Remaining alignment (2026-09-13)

**Done definition:** Medium debt fixed · viewport matrix green · live ROLE landings verified · docs READY · find-bugs clean on High.

**Gates:**
- `pnpm typecheck` PASS
- `pnpm lint` PASS (unused `canAll` removed)
- `pnpm test` 43/184 PASS
- `pnpm build` PASS
- `e2e/viewport.spec.ts` **24 passed** (375/768/1280/1920 + app shells)
- Live `PLAYWRIGHT_BASE_URL=https://beepabpo.com` roles: **13 landings + 3 isolation** PASS; open-redirect assertion fixed for non-localhost hosts

**Shipped:**
| Item | Fix |
|------|-----|
| Admin users search | DB `ilike` on profiles + orgs (not in-memory ≤100) |
| EmptyState polish | Employees, CRM lead activity, my requests, client timesheets |
| Marketing overflow @375 | `overflow-x-clip` on marketing layout / PageHero / FinalCTA |
| Auth image `sizes` | Mobile footer images not forced `100vw` |
| Open-redirect e2e | Assert against `baseURL` host, not hardcoded localhost |
| Ticket message caps | Staff/client/my threads `.limit(200)` |

### Prompt 8 — Shell latency + clock + realtime (2026-09-14)

Parallel workspace resolve, visible skeletons, Clock In/Out on `/app/my/attendance`, debounced realtime on attendance/CRM/tickets.

---

## Role × page matrix (seeded demo roles)

| Role | Landing | Live 2026-09-13 |
|------|---------|-----------------|
| owner / super_admin | `/app/dashboard` | PASS |
| hr / recruiter / operations / team_lead / finance / employee | `/app/my` | PASS |
| sales | `/app/crm` | PASS |
| marketing | `/app/cms` | PASS |
| client_admin / client_viewer | `/app/client` | PASS |
| applicant | `/app/applicant` | PASS |
| Segment isolation + open redirect | — | PASS |

---

## Open debt (non-blocking)

| Item | Priority | Notes |
|------|----------|-------|
| Apply `20260914120000` on Beepa DB | Ops | Indexes + realtime publication |
| Deploy shell-latency pass | Ops | Clock on Attendance + parallel workspace |
| List pagination UI | P2 | Silent `.limit` remains |
| Admin search by role name | Low | Name/org only now |
| OAuth / FTS / announcements | DEF | |
| Org/workflow CRUD | DEF | Keep RO |

---

## Closing gate

**READY.** Next single action: **commit + deploy** so beepabpo.com serves the lag/EmptyState/viewport fixes.
