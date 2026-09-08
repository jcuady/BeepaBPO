# System Audit

## Summary

- **Audit date:** 2026-09-08
- **Branch:** `main`
- **Framework:** Next.js 16 App Router + React 19 + Supabase Auth/RLS
- **Live:** https://beepabpo.com · DB `nwvnawgxkzwiercllgmg`
- **Build status:** PASS (`pnpm build`, exit 0)
- **Test status:** PASS (`pnpm test` — 37 files, 145 tests)
- **Typecheck / lint:** PASS
- **OAuth:** Deferred (email/password only)
- **Runtime browser matrix:** NOT RUN this pass (static + unit/seam + production build)

## Critical Issues

| Severity | Area | Issue | Status |
|----------|------|-------|--------|
| P0 | — | None found (no auth bypass / tenant leak / broken primary build) | Clear |
| P1 | Leave | Cancel leave had no confirm | **Fixed** — `ConfirmDialog` |
| P1 | Client portal | `allow_ticketing` / billing / attendance flags ignored | **Fixed** — nav + pages + `createTicket` |
| P1 | Marketing | Fake Trusted-by logos | **Fixed** — honest copy |
| P1 | Marketing | Fake stats / testimonial | **Fixed** — honest proof band |

## Functional Issues

| Page/Feature | Problem | Root Cause | Fix | Verified |
|--------------|---------|------------|-----|----------|
| Leave cancel | Immediate destructive action | No confirm wrapper | `ConfirmDialog` in `CancelLeaveButton` | Unit seam test |
| Client Tickets/Billing/Attendance | Flags not enforced | Only timesheet flag wired | `loadClientPortalFlags` + nav `portalFlag` + page gates + create guard | Unit seam + typecheck |
| Admin orgs/workflows | Looked like CRUD | Missing honesty copy | “View-only” subtitles | Code review |
| Footer Services | Four identical `/services` links | Hash targets missing | `#services` / `#why-beepa` style anchors | Code review |

## UI/UX Issues

| Page/Component | Issue | Design Rule | Fix | Verified |
|----------------|-------|-------------|-----|----------|
| `TrustedBySection` | Placeholder brand logos | No fabricated social proof | Honest BPO positioning copy | Seam test |
| `ProofStrip` | Fake metrics + quote | No fabricated social proof | CTA band, no vanity numbers | Seam test |
| Admin orgs/workflows | Implied editable admin | Honesty for RO surfaces | View-only subtitle | Code review |

## Validation Issues

| Form | Field | Problem | Fix |
|------|-------|---------|-----|
| Document upload | meta | Client zod thin; server schema OK | Deferred P2 |
| Notification prefs | prefs object | Loose server accept | Deferred P2 |
| Invoice payment | form vs server | Possible schema drift | Deferred P2 |

## Responsive Issues

| Screen | Viewport | Issue | Fix |
|--------|----------|-------|-----|
| App shell | — | Existing PageContainer / sidebar patterns | No new layout bugs found in static review |
| Marketing | — | Proof/trusted sections use Container + clamp type | Visual matrix **not** re-run |

## Accessibility Issues

| Component | Problem | Fix |
|-----------|---------|-----|
| Leave cancel confirm | Needed destructive dialog semantics | Uses shared `ConfirmDialog` |
| Broader a11y | Playwright a11y suite exists | **Not re-run** this pass |

## Backend/API Issues

| Endpoint/Service | Problem | Fix | Verified |
|------------------|---------|-----|----------|
| `createTicket` | Client could create when `allow_ticketing=false` | Guard on `client_settings` | Code + seam test |
| SECURITY DEFINER grants | Anon execute (prior audit) | Migration `20260908120000` | Prior release |
| Reply on existing tickets when ticketing off | Page hides create; reply path may remain | Document as residual P2 if product wants hard lock | Open |

## Missing Features / Incomplete Implementations

| Area | Missing Behavior | Priority |
|------|------------------|----------|
| HR employee `[id]` | Edit form (display-only today) | P2 product |
| Admin users | Edit / revoke / role change UI | P2 product |
| Admin orgs / workflows | CRUD (intentionally RO) | P2 or keep RO |
| Payroll recalculate / send-to-client | Confirm dialogs | P2 polish |
| Command search | Real entity FTS (nav-only today — honest) | P3 |
| Announcements CMS | Replaced by notifications | DEF |
| Social OAuth | Deferred | DEF |
| Supabase advisor | Leaked-password protection (dashboard) | Ops |
| Ticket reply when `allow_ticketing=false` | Optional hard block | P2 |
| `pnpm audit --prod` | High `browserslist` via `@serwist/next` (build-time) | Ops — bump serwist when patched |

## Inventory (condensed)

- **`app/**/page.tsx`:** 89 routes (see prior table in git history / ROUTES.md)
- **Guards:** `resolveWorkspace` + segment layouts (`my` / `client` / `applicant`) + `requirePermission` / `can`
- **Dead UI scan:** no `href="#"`, no empty `onClick`, no TODO decoys in app/components
- **Roles:** Owner, Super Admin, Finance, HR, Team Lead, Employee, Client Admin/Viewer, Applicant (seed demos)

## Tests Added or Updated

- `tests/principal-audit-p1.test.ts` — ConfirmDialog on leave cancel; honest marketing; portal flag seams

## Full next-steps plan

### Now (shipped this audit)

1. P1 leave confirm, portal flags, marketing honesty, admin RO copy, footer/docs hygiene.
2. Verify typecheck / lint / test / build green.
3. Publish `docs/SYSTEM_AUDIT.md` + status docs.

### Next sprint (highest value)

1. **Employee record edit** — HR form on `/app/employees/[id]` (`employees.manage`).
2. **Admin user lifecycle** — edit/revoke/role change on `/app/admin/users`, or keep invite-only with clearer empty states.
3. **Destructive confirms** — payroll recalculate + send-to-client timesheet.
4. **Portal hard-lock** — gate `addTicketMessage` (and deep links) when `allow_ticketing=false`.
5. **Manual ROLE_CHECKLIST** — walk Owner → Finance → HR → Employee → Client on live demo accounts; check remaining empty boxes.

### Later / ops

1. Decide: keep workflows/orgs **view-only** forever vs build CRUD.
2. Real FTS / announcements CMS only if product asks.
3. OAuth when IdP + redirect URLs ready.
4. Supabase Auth leaked-password protection in dashboard.
5. Re-run `pnpm test:e2e` + viewport matrix before a marketing launch.

## Final Verification

- [x] Production build passes (`pnpm build`, exit 0, 2026-09-08)
- [x] Type check passes (`pnpm typecheck`)
- [x] Lint passes (`pnpm lint`)
- [x] Automated tests pass (145)
- [x] Critical user flows tested (P1 seams + unit; full e2e not re-run)
- [ ] No major console errors — **NOT VERIFIED** (no browser session this pass)
- [x] No broken routes (build route table + nav/href static scan)
- [x] No dead buttons (static scan; P1 cancel fixed)
- [x] Forms validate correctly (sampled; residual P2 gaps documented)
- [x] Permissions verified (static + prior role audit; portal flags added)
- [ ] Mobile verified — **NOT VERIFIED** this pass
- [ ] Tablet verified — **NOT VERIFIED** this pass
- [ ] Desktop verified — **NOT VERIFIED** this pass
- [x] Branding consistency verified (marketing honesty + Beepa tokens on fixed strips)
