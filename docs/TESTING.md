# Testing

## Unit (Vitest)

```bash
pnpm test          # vitest run
pnpm test:watch    # vitest
```

Tests live under `tests/`:

| File | Focus |
|------|--------|
| `attendance.test.ts` | Attendance helpers / clock logic |
| `permissions.test.ts` | `can` / `canAny` |
| `workspace-flags.test.ts` | internal / client / applicant-only flags |
| `safe-next.test.ts` | open-redirect hardening |
| `landing.test.ts` | `landingPathFor` |

## E2E (Playwright)

```bash
pnpm test:e2e       # playwright test
pnpm test:e2e:ui    # interactive
```

Requires:

- Running app (Playwright config starts or targets local server)
- `DEMO_PASSWORD` matching seeded users
- Supabase public keys pointing at a DB with `pnpm seed:demo` applied

### Specs

- `e2e/roles.spec.ts` — all 13 demo roles land correctly; client blocked from employee login; segment tree isolation; `safeNext` open-redirect block
- `e2e/a11y.spec.ts` — axe WCAG 2 A/AA on login, `/app/my`, `/app/client`, `/app/dashboard`, `/app/applicant` (no serious/critical)
- `e2e/filters.spec.ts` — tickets + applicants + CRM + leave filter query params update URL
- `e2e/mutations.spec.ts` — leave submit, confirm-cancel, ticket validation
- `e2e/demo-ready.spec.ts` — unauth redirect, forbidden tickets, superadmin Jump-in, approvals nav, applicant seed

### Coverage limits

E2E does **not** yet cover every mutation, confirm-cancel path, or every filtered list. Treat [TEST_PLAN.md](./TEST_PLAN.md) as the full gate; QA checklist splits Automated vs Manual.

## Related quality gates

```bash
pnpm typecheck
pnpm lint
pnpm build
```

CI runs typecheck → lint → unit → build; e2e runs when secrets are present (see [DEPLOYMENT.md](./DEPLOYMENT.md)).
