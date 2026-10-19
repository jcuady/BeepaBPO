# Testing

How to run everything, sign in as anyone, and reach any screen. For the full
route inventory see [ROUTES.md](./ROUTES.md); for what each role may reach see
[ROLES_AND_PAGES.md](./ROLES_AND_PAGES.md) and [PERMISSIONS.md](./PERMISSIONS.md).

---

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Or against a production build — **what the gates expect, on port 3100**:

```bash
pnpm build
pnpx next start -p 3100
```

Stop the listener before `pnpm build`. A build over a running `next start` on
the same port fails confusingly.

---

## Demo sign-in cards

Both login pages render a **Demo users** card grid. Click a card → the form
fills → press Sign in. Each card shows **where that role lands**, which is the
fastest way to navigate the product.

| Page | Portal | Cards | Cross-links |
|---|---|---|---|
| `/login` | client | Client Admin, Client Viewer, Applicant | 10 employee roles |
| `/employee/login` | employee | Owner, Super Admin, HR, Recruiter, Sales, Marketing, Operations, Team Lead, Finance, Employee | 3 client roles |

Deep links work too:

```
/login?demo=owner@demo.beepabpo.com
/employee/login?demo=sales@demo.beepabpo.com
```

### The 13 roles

| Role | Email | Lands on | Portal |
|---|---|---|---|
| Owner | `owner@demo.beepabpo.com` | `/app/dashboard` | employee |
| Super Admin | `superadmin@demo.beepabpo.com` | `/app/dashboard` | employee |
| HR | `hr@demo.beepabpo.com` | `/app/my` | employee |
| Recruiter | `recruiter@demo.beepabpo.com` | `/app/my` | employee |
| Sales | `sales@demo.beepabpo.com` | `/app/crm` | employee |
| Marketing | `marketing@demo.beepabpo.com` | `/app/cms` | employee |
| Operations | `operations@demo.beepabpo.com` | `/app/my` | employee |
| Team Lead | `teamlead@demo.beepabpo.com` | `/app/my` | employee |
| Finance | `finance@demo.beepabpo.com` | `/app/my` | employee |
| Employee | `employee@demo.beepabpo.com` | `/app/my` | employee |
| Client Admin | `clientadmin@demo.beepabpo.com` | `/app/client` | client |
| Client Viewer | `clientviewer@demo.beepabpo.com` | `/app/client` | client |
| Applicant | `applicant@demo.beepabpo.com` | `/app/applicant` | client |

All thirteen share **one** password: `DEMO_PASSWORD` from `.env.local`.

### Two things that have broken demo sign-in

**1. The cards are hidden under `next start`.** `lib/demo/login.ts` returns
`null` unless `DEMO_PASSWORD` is set **and** either `NODE_ENV` is not
`production` or `ALLOW_DEMO_LOGIN=true`. `next start` sets `NODE_ENV=production`,
so for local testing against a production build add to `.env.local`:

```dotenv
ALLOW_DEMO_LOGIN=true
```

**2. Quote the demo password.** An unquoted value containing `#` is truncated by
Next's env loader at the `#`. Both lines below are the *same* secret, shown with
a placeholder value:

```dotenv
DEMO_PASSWORD=example#fragment     # ❌ arrives as "example" — everything from # is gone
DEMO_PASSWORD="example#fragment"   # ✅ arrives whole
```

The symptom is misleading: every demo sign-in returns *"Invalid email or
password"* while the direct Supabase path — which parses the file itself —
authenticates fine, because the password is a different, shorter string by the
time it reaches the form. If demo sign-in fails and the credential looks right,
check this first.

> The real value lives in `.env.local` (gitignored) and in your password manager.
> **Never write it into this repo** — a value committed to a public repository is
> compromised the moment it is pushed, and deleting the line afterwards does not
> undo that. See `docs/SECURITY.md`.

### Do not enable demo login in production

These are **real accounts in the real auth project**. `ALLOW_DEMO_LOGIN=true` on
production publishes a working one-click sign-in to `owner@demo.beepabpo.com` —
payroll, CRM, client records — on a public page. It is off by default for that
reason. Turn it on only to demo, and turn it off again.

---

## Public routes

| Route | What it is |
|---|---|
| `/` | Landing page (the reference design) |
| `/about`, `/why-beepa`, `/services`, `/careers`, `/contact` | Marketing |
| `/login`, `/signup`, `/forgot-password` | Client auth |
| `/employee/login` | Employee auth |
| `/terms`, `/privacy` | Legal |
| `/app/*` | Product app — redirects to `/login` when signed out |

The "Build my team" and "Careers" dialogs submit to real server actions and
create a lead. On success the form is replaced by a confirmation the reader
dismisses with **Done** — it does not close on its own. Reopening always shows
an empty form.

The planner settings shown in the dialog (size, role, coverage) are **not**
stored on the lead: the actions read a fixed field list, so capturing them
needs a schema change.

---

## Unit (Vitest)

```bash
pnpm test          # vitest run
pnpm test:watch    # vitest
```

Tests live under `tests/`. The ones worth knowing by name:

| File | Focus |
|------|--------|
| `attendance.test.ts` | Attendance helpers / clock logic |
| `permissions.test.ts` | `can` / `canAny` |
| `workspace-flags.test.ts` | internal / client / applicant-only flags |
| `safe-next.test.ts` | open-redirect hardening |
| `landing.test.ts` | `landingPathFor` |
| `storage-rls-safe-cast.test.ts` | storage policy UUID cast + its negative controls |
| `demo-login-picker.test.ts` | demo gating and both forms' autofill wiring |
| `seo-payslip.test.ts`, `seo-gsc.test.ts` | shipped brand/SEO assets exist and are referenced |

---

## E2E (Playwright)

```bash
pnpm test:e2e       # playwright test
pnpm test:e2e:ui    # interactive
```

Requires a running app, a `DEMO_PASSWORD` matching the seeded users, and Supabase
public keys pointing at a DB with `pnpm seed:demo` applied.

### Specs

- `roles.spec.ts` — all 13 demo roles land correctly; client blocked from employee login; segment tree isolation; `safeNext` open-redirect block
- `demo-login.spec.ts` — the demo card grid and its autofill
- `a11y.spec.ts` — axe WCAG 2 A/AA on login, `/app/my`, `/app/client`, `/app/dashboard`, `/app/applicant` (no serious/critical)
- `filters.spec.ts` — tickets + applicants + CRM + leave filter query params update URL
- `mutations.spec.ts` — leave submit, confirm-cancel, ticket validation
- `demo-ready.spec.ts` — unauth redirect, forbidden tickets, superadmin Jump-in, approvals nav, applicant seed
- `app-smoke.spec.ts`, `client.spec.ts`, `owner.spec.ts`, `viewport.spec.ts` — per-portal smoke and responsive checks

### Coverage limits

E2E does **not** cover every mutation, confirm-cancel path, or every filtered
list. Treat [TEST_PLAN.md](./TEST_PLAN.md) as the full gate; the QA checklist
splits Automated vs Manual.

---

## Gates

```bash
node scripts/audit/qa-run-all.mjs        # the 15 fast-tier checks + the gate
node scripts/audit/qa-run-all.mjs --all  # adds the slow role sweep (~20 min)
```

| Check | What it proves |
|---|---|
| `contrast` | WCAG 2.2 AA text contrast on 13 public + 44 signed-in app routes |
| `typography` | DM Sans on marketing/auth, Inter in the app |
| `runtime-radius` | Computed corner radius on public routes |
| `not-found` | Every 404 has a working way out |
| `dialog-keyboard` | Confirm dialogs: focus in, focus back, Escape and Cancel |
| `command-palette` | cmd-K opens, filters, navigates, returns focus |
| `notification-bell` | Accessible name, AA contrast, keyboard exit |
| `internal-links` | No internal link lands on an error page |
| `public-careers` | The careers list searches, filters, and says honestly when nothing matches |
| `client-invite` | The invite flow, driven through its real form |
| `form-reset-defaults` | Every form that calls `reset()` defaults every field it registers |
| `suite-base-url` | Every audit script agrees on `QA_BASE_URL` and port 3100 |
| `auth-callback` | A dead verification link explains itself instead of failing silently |
| `server-fresh` | The process answering is not older than `.next/BUILD_ID` |
| `gate-coverage` | Every declared audit script is wired into a release gate |
| `gate` | vitest + `tsc --noEmit` |

Individually:

```bash
pnpm audit:contrast
pnpm audit:typography
pnpm audit:design          # no raw primitives, no hardcoded colours
pnpm audit:responsive      # public routes across the viewport matrix
node scripts/audit/audit-role-sweep.mjs   # every nav-reachable page, every role
```

Each gate writes evidence to `docs/evidence/*.json` and exits non-zero on
failure. **A gate that measures nothing fails on purpose** — read `status`,
`totals` and `appCoverage` rather than trusting the exit code alone.

`client-invite` spends the environment's single outbound invite. If the mail
quota is exhausted it reports `BLOCKED` and writes to
`client-invite-blocked.json` instead of overwriting the last good result. That
is the quota, not a regression.

---

## Related quality gates

```bash
pnpm typecheck
pnpm lint
pnpm build
```

CI runs typecheck → lint → unit → build; e2e runs when secrets are present (see
[DEPLOYMENT.md](./DEPLOYMENT.md)).

---

## When something looks wrong

| Symptom | Likely cause |
|---|---|
| Demo cards missing | `ALLOW_DEMO_LOGIN` unset under `next start`, or no `DEMO_PASSWORD` |
| Demo sign-in says invalid credentials | Unquoted `#` in `DEMO_PASSWORD` (above) |
| `/app/*` bounces to `/login` | Not signed in, or the role lacks that permission |
| Gates pass but the page looks wrong | Gates check structure and colour, not taste — screenshot it |
| Diffs show every line changed | `.gitattributes` pins LF; do not turn it off |