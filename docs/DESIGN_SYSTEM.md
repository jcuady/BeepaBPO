# Design system

Brand tokens live in `app/globals.css` (`@theme inline`). Light mode only.

## Color tokens

| Token | Value | Use |
|-------|-------|-----|
| `navy` | `#1f2058` | Headings, brand text |
| `green` | `#119446` | Brand accent |
| `green-strong` | `#0b6e34` | Interactive green (WCAG AA on white) |
| `lime` | `#93c63d` | Accent highlight |
| `ink` | `#17182b` | Body foreground |
| `slate` | `#667085` | Secondary text |
| `line` | `#eaecf0` | Borders |
| `mist` | `#f5f7f6` | Soft surfaces / secondary |
| `soft-green` | `#eef7e8` | Active nav, accent wash |

Primary UI maps to green-strong; cards/borders use white + line.

## Typography

| Role | Font | CSS |
|------|------|-----|
| Display / headings | Manrope | `--font-manrope`, `font-display` |
| Body | Inter | `--font-inter`, `font-sans` |

Loaded in `app/layout.tsx` via `next/font/google`.

## Radii

`--radius-sm` 8px · `--radius-md` 12px · `--radius-lg` 16px · `--radius-xl` 24px.

## App UI primitives

| Component | Path | Role |
|-----------|------|------|
| `PageContainer` | `components/app/page-container.tsx` | Max-width shell (`narrow` / `default` / `wide`) + `space-y-6` |
| `PageHeader` | `components/app/page-header.tsx` | Greeting / title + subtitle |
| `FilterBar` / `FilterSelect` | `components/app/filter-bar.tsx` | GET form chrome for list filters (wrap in `<form method="get">`) |
| `Card` | `components/ui/card.tsx` | Content sections / mobile-first history |
| `Table` | `components/ui/table.tsx` | Dense admin/ops queues (horizontal scroll on small screens) |
| `EmptyState` | `components/app/empty-state.tsx` | Zero-data placeholder |
| `MetricCard` | `components/app/metric-card.tsx` | KPI tile |
| `StatusBadge` | `components/app/status-badge.tsx` | Status chip (attendance, leave, ticket, cash-advance, CRM, ATS, priority) |
| `ConfirmDialog` | `components/app/confirm-dialog.tsx` | Confirm before irreversible / status mutations |

Shell: `AppShell` + sidebar (`min-h-11` nav rows) + mobile bottom nav.

### Table vs Card rule

- **Dense queues** (tickets, leave, cash-advances, applicants, CRM leads, admin audit/users, client attendance, employees directory): use `Table` + `StatusBadge`.
- **Employee/client mobile-first history** (e.g. my leave request cards): Cards remain OK.

### Confirm dialogs

Enter ≤200ms ease-out / zoom-in; exit faster. Modals use center transform-origin. Create flows stay **inline** with Reset — do not invent modal creates.

## Spacing

Prefer `space-y-6` page stacks, `gap-4` grids, `p-4` card content. Touch targets: **min 44px** (`min-h-11` / `min-w-11`).

## Motion

Keep transitions short: **150–300ms**, ease-out (`--ease-out`). Sidebar width transitions use ~200ms. Prefer opacity/transform; respect reduced motion where marketing uses scroll effects.

## Icons

Tabler icons in app chrome (`stroke={1.75}`); shadcn config also references Lucide for generated UI.
## Principal QA � UI consistency bar (2026-09-13)

Audited hubs (CRM, tickets, client portal, my workspace, CMS) should:

- Use `PageContainer` + `PageHeader` + `EmptyState` for zero-data / flag-off states (never a blank page).
- Keep primary actions `min-h-11` (44px).
- Prefer `ConfirmDialog` for status / irreversible mutations.
- Portal feature-off states use the same EmptyState pattern as billing/tickets.
- Staff list pages may use silent `.limit` until pagination UI ships (see COMPLETION_LEDGER).

