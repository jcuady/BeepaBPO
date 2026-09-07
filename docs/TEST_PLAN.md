# Test plan (release gate)

Full release checklist for Beepa. Map each item to automation where it exists; everything else is **manual** until covered.

Demo users: `*@demo.beepabpo.com` + `DEMO_PASSWORD`. Seed: `pnpm seed:demo`.

## 1. Auth and routing

| Check | Automation |
|-------|------------|
| 13 demo roles land on expected home | `e2e/roles.spec.ts` |
| Client blocked from `/employee/login` | `e2e/roles.spec.ts` |
| Employee blocked from `/app/client/*` | `e2e/roles.spec.ts` |
| Client blocked from `/app/my/*` | `e2e/roles.spec.ts` |
| `?next=//evil.com` stays on-site | `e2e/roles.spec.ts` |
| Unauthenticated `/app/*` → login | Manual (proxy) |
| Missing permission → forbidden | Manual |

## 2. Nav chrome per role

| Check | Automation |
|-------|------------|
| Sidebar / mobile nav matches role tree | Manual (see [ROLES_AND_PAGES.md](./ROLES_AND_PAGES.md)) |
| Dual membership shows both groups | Manual |
| Command search limited to permitted routes | Manual |

## 3. Filters on list pages

| Page | Params | Automation |
|------|--------|------------|
| `/app/tickets` | `q`, `status`, `priority` | `e2e/filters.spec.ts` |
| `/app/recruitment/applicants` | `q`, `stage` | `e2e/filters.spec.ts` |
| `/app/crm/leads` | `q`, `status` | Manual smoke |
| `/app/leave` | `status` (default pending) | Manual smoke |
| `/app/cash-advances` | `status` | Manual smoke |
| `/app/admin/audit` | `q` | Manual smoke |
| `/app/client/attendance` | `from`, `to`, `status` | Manual smoke |
| `/app/employees` | `q` (DB ilike) | Manual smoke |

Assert: Apply updates URL query string; rows reflect filter (or empty state).

## 4. Mutation smoke (verticals)

| Flow | Automation |
|------|------------|
| Employee leave submit | `e2e/mutations.spec.ts` |
| Ticket create | Manual (+ toast) |
| Application stage move (with confirm) | Manual |
| Cash advance submit / review | Manual |
| CRM lead create | Manual |
| CRM lead status update | Source-scan `tests/crm-lead-status.test.ts` + manual |
| Reports CSV export | Unit `lib/reports/csv` + source-scan `tests/reports-export.test.ts` |
| Auth no OAuth decoys | Source-scan `tests/auth-no-oauth-decoys.test.ts` |
| NTE resolve / close-out | Source-scan `tests/nte-resolve.test.ts` + manual |
| Admin invite | Source-scan `tests/admin-invite.test.ts` |
| Cron + push ops smoke | Unit `authorizeCronRequest` + source-scan `tests/ops-cron-push.test.ts`; live `pnpm smoke:cron` |
| NTE create / respond | Manual |
| Clock in/out | Manual |
| Payroll recalculate | Manual |

## 5. Confirm dialogs

| Action | Expectation | Automation |
|--------|-------------|------------|
| Ticket status change | Cancel restores select; no mutate | Manual |
| Application stage move | Cancel restores select | Manual |
| Leave approve/reject | Cancel closes; no mutate | Manual |
| Cash-advance approve/reject | Cancel closes; no mutate | Manual |

## 6. Validation

| Check | Automation |
|-------|------------|
| Invalid RHF form shows field error (client Zod) | Manual |
| Server `fieldErrors` mapped via `applyFieldErrors` | Manual |
| Toast fallback when `result.error` missing | Manual |

## 7. Approvals deep links

| `entity_type` | Link target |
|---------------|-------------|
| `leave_request` | `/app/leave` |
| `cash_advance` / `cash_advance_request` | `/app/cash-advances` |
| `ticket` | `/app/tickets/[id]` |
| default | `/app/my/requests` |

Automation: Manual from `/app/approvals` with seeded pending rows.

## 8. Accessibility

| Check | Automation |
|-------|------------|
| Login, my, client, dashboard, applicant — no serious/critical axe | `e2e/a11y.spec.ts` |
| Form-heavy pages (leave, tickets, CRM) | Manual axe / keyboard |
| Touch targets ≥ 44px on primary actions | Manual |

## 9. Known out-of-scope backlog (must stay unchecked until built)

- [x] Storage upload / signed download UI — apply `20260907140000_documents_client_insert.sql` on Beepa for client upload RLS
- [x] Employee invite / hire convert from ATS
- [x] Attendance-correction **review** UI
- [x] Payslip PDF generation / download (`lib/payroll/payslip-pdf.ts` + route)
- [x] Favicon + marketing SEO (icons, OG, sitemap careers, JSON-LD logo)
- [x] Job post update / close UI
- [x] Invoice detail + payments UI
- [x] CMS admin (`cms.manage`) — About, FAQs, blog, services, industries, testimonials, case studies; public pages wired
- [x] CRM deals pipeline (`crm.manage`) — create + stage moves; `/app/crm/deals`
- [x] Reports export (`GET /app/reports/export`, `reports.export`)
- [x] Dynamic approval workflow engine (resolve by code + multi-step advance; admin `/app/admin/workflows`)
- [x] Client SLA compliance metric
- [x] Client-org invite UI (`inviteClientUser`, `/app/clients`)
- [x] CMS edit-in-place for existing rows (`CmsEditButton` + update* actions)
- [x] Deal → client convert + CRM proposals UI
- [x] Ticket assignment UI (`assigned_user_id`)
- [x] SLA policy admin editor (`/app/tickets/sla`)
- [ ] Payroll approval via workflow engine UI
- [ ] Social OAuth CTAs — **deferred**; email/password is the supported auth path

## CI / local gate

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```

See [TESTING.md](./TESTING.md) and [QA_CHECKLIST.md](./QA_CHECKLIST.md).
