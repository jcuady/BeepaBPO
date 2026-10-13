# Design system

One design system, enforced. This document is the contract; `scripts/audit-design-system.mjs`
is the enforcement. Everything below is checked by something, not merely described.

Brand tokens live in `app/globals.css` under `@theme inline`. Light mode only
(`color-scheme: light` is set in both `@theme` and `:root`).

---

## 1. Colour

### 1.1 Brand palette

| Token | Value | Use |
|-------|-------|-----|
| `navy` | `#1f1c4f` | Headings, brand text |
| `green` | `#008338` | Interactive green — **fill only** (4.88:1 under a white label) |
| `green-strong` | `#0b6e34` | Textual green on white or any tint (6.37:1) |
| `lime` | `#93c63d` | Accent highlight on navy (7.77:1); **never** on a light surface |
| `ink` | `#13161c` | Body foreground |
| `slate` | `#5e6066` | Secondary text |
| `line` | `#d8d8d3` | Borders |
| `mist` | `#f2f2ee` | Soft surfaces |
| `soft-green` | `#eaf3e2` | Active nav, accent wash |
| `background` | `#fafaf8` | Page. Cards stay `#ffffff` against it |

**The green split is load-bearing, not decorative.** `green` is a *fill* colour:
4.88:1 against a white label, but only **4.27:1 as text** on a tinted surface,
which is under AA. Anything a human reads uses `green-strong`. `lime` is the
same idea in reverse — it is a brand accent on navy, not a mark on white.

Ratios are measured by `scripts/audit/audit-contrast.mjs` on rendered pages,
not asserted here. An earlier version of this table was built from a luminance
function that never linearised sRGB, which understated every value; see the
changelog entry for the corrected figures.

That gate covers **13 public routes plus all 44 static app routes**, signed in
as `owner`, so the rule above is checked against the dense 12–14px tables and
payroll screens rather than only the marketing pages. `scripts/audit-typography.mjs`
does the same for the body face, and both declare their coverage in the evidence
file — a missing demo credential is recorded as a gap, never as a pass.

### 1.2 Semantic status layer

The palette above said nothing about what "a warning surface" *is*, so three
separate files each invented one: the attendance heatmap built a six-colour status
map inline, the team-status donut a four-colour categorical ramp, and the
application-stage badge a five-tone scale. Same decision, three unrelated palettes,
no shared vocabulary — which is exactly why the app felt inconsistent even though
every component "used tokens".

Each status is now a **pair**: a saturated foreground for text and icons, and a
tinted surface for backgrounds. Pairing them in the token layer means a new status
cannot be added without choosing both.

| Foreground token | Surface token | Meaning |
|---|---|---|
| `positive` (`#0b6e34`) | `positive-surface` (`#eaf3e2`) | Success, approved, present, healthy |
| `caution` (`#92610a`) | `caution-surface` (`#fdf3e0`) | Needs attention but not broken |
| `critical` (`#c62b2f`) | `critical-surface` (`#fdecea`) | Failed, rejected, overdue |
| `info` (`#1b6ea8`) | `info-surface` (`#e8f2fa`) | Neutral informational state |
| — | `neutral-surface` (= `mist`) | Inactive / unknown / on-hold |

All foreground values are ≥ 4.5:1 on their own surface and on white.

`caution` is a **brown-gold, not amber** — amber is not in the brand palette and
`lime` (#93c63d) fails contrast as text. `lime` is used as the *fill* that separates
"warning" from "neutral" where a coloured chip is needed, never as the label text.

**Consumption rule:** a component never picks a colour. It asks the domain for a
tone (`neutral | progress | positive | warning | negative`) and maps that tone to
the token pair. `lib/recruitment/application-stage.ts` and
`lib/attendance/status-colors.ts` are the two reference implementations.

### 1.3 Categorical data ramp

Chart series need colours that stay distinguishable *next to each other*, which
navy/green/lime do not guarantee. Separate scale, in assignment order:

`series-1` green-strong · `series-2` `#1b6ea8` · `series-3` `#92610a` ·
`series-4` slate · `series-5` `#7a3f9d`

Every step clears the 3:1 non-text floor on every light surface in the system (worst case
5.76:1). `series-5` was `--color-lime` until it was measured: lime is 1.68:1 on a white
card, so the fifth entry of a documented ramp could not actually be drawn. Lime remains a
brand accent on navy, where it is 7.77:1 — it is only unusable as a mark on a light field.

Assign in index order and never re-order between views, so the same colour means the
same series everywhere. Empty/inactive/unknown data cells use `--color-data-empty`
(`#e8eaee`) so "no data" never reads as a real category.

### 1.4 Sidebar tokens

`--sidebar`, `--sidebar-foreground`, `--sidebar-border`, `--sidebar-accent`,
`--sidebar-accent-foreground`. These lived as arbitrary Tailwind properties on the
`<Sidebar>` element in `components/app/app-sidebar.tsx`, which re-declared the
palette as hex at the call site — a palette change would have had to be made twice
and nothing would have said the second copy was missed.

### 1.5 The colour rule

**No colour literal (`#rrggbb`, `#rgb`, `rgb()`, `rgba()`) may appear anywhere under
`app/` or `components/` outside `app/globals.css`.** The auditor fails the build on
this.

Two allowlisted files, both because they emit *serialized* output that never touches
the stylesheet: `app/manifest.ts` (PWA manifest JSON) and `app/layout.tsx` (viewport
`themeColor` meta). Both are allowlisted with a printed reason, so the exception
stays visible rather than becoming a silent hole.

---

## 2. Typography

| Role | Font | CSS |
|------|------|-----|
| Display / headings | Manrope | `--font-manrope`, `font-display` |
| Public body — marketing + auth | DM Sans | `--font-marketing`, `font-marketing` |
| Product body — the app | Inter | `--font-inter`, `font-sans` |
| Editorial pull quotes / hero headline | Instrument Serif | `--font-editorial` |

**Why two body faces.** The supplied reference specifies DM Sans; the brandbook
assigns Inter to body, forms, tables, dashboards and CRM. Picking one winner
would have left the other surface wrong. Splitting by surface removes the only
seam a visitor could see — `/` used DM Sans while every other route used Inter,
so navigating from one to the other changed the typeface.

`font-marketing` is applied on the `(marketing)` and `(auth)` layouts, not per
page, so a new route in either group inherits it. The product app keeps
`font-sans` (Inter) from `app/globals.css`, which is what the dense 12–14px
tables, payroll and CRM need. Headings are Manrope on every surface already.

Loaded in `app/layout.tsx` via `next/font/google`. `body` is 16px / 1.5 by default;
do not set a smaller root font size — the 14px density that desktop admin tables
want is a local decision (`text-sm`), never a global one.

---

## 3. Body text on phones

`body` is 16px, but **a Tailwind size class on a child overrides it**, and `text-sm`
(14px) or `text-xs` (12px) applied to real prose makes it 14px or 12px on a phone.
Desktop admin density wants that. A phone does not.

The established pattern, already used 29 times across 22 files:

```tsx
<p className="text-base text-slate sm:text-sm">…</p>   // 16px mobile, 14px desktop
<p className="text-base text-slate sm:text-xs">…</p>   // 16px mobile, 12px desktop
```

`scripts/audit-app-responsive.mjs` enforces it: at a phone viewport it reports
`TEXT<16 n` for any text node under 16px, excluding uppercase labels, wide-tracked
text, monospace, nav, chips and short bold labels — i.e. it targets prose, not
badges. Fix the element it names rather than lowering the threshold; the threshold is
the reason 14px is a choice rather than an accident.

### What `Card` does about font size

`components/ui/card.tsx` sets `text-base sm:text-sm` on the `Card` wrapper — **16px
on a phone, 14px on a desktop** — so anything inside a card that does not declare its
own size inherits a readable size by default.

This was originally a bare `text-sm`, which set 14px on the whole subtree. Every
plain `<p>` inside a card rendered at 14px on a phone, and because `CardTitle`
already compensated with `text-base`, cards *looked* correct while their paragraphs
quietly violated the 16px-mobile rule. The auditor only flags text of **25 characters
or more**, so short values like "CloudPeak" never tripped it and the defect survived
a full 232-combination sweep.

`tests/design-system-contract.test.ts` now pins this, including a negative control
that rejects a bare `text-sm` even when `sm:text-sm` is also present — `text-sm
sm:text-sm` still renders 14px on a phone, so the presence of the responsive variant
alone would prove nothing.

If you need genuinely small text inside a card, say so explicitly (`text-xs`,
`uppercase`, or a `data-dense` region). Do not expect the wrapper to make it small for
you, and do not re-add a blanket `text-sm` to `Card`.

---

## 4. Radius

`--radius-sm` 8px · `--radius-md` 12px · `--radius-lg` 16px · `--radius-xl` 24px

Use the scale classes (`rounded-sm|md|lg|xl`). Arbitrary `rounded-[Npx]` values are
**reported but do not fail** the gate — currently 12 distinct values across 106 uses,
8 of them off-scale. That is deliberate: a 106-site radius sweep cannot be reviewed
for visual regression in one pass, so the count is a progress metric until the sweep
lands. New code must use the scale.

---

## 5. Controls

### 5.1 Dropdowns — `NativeSelect`, not shadcn `Select`

**Every `<select>` in this app is rendered by `components/ui/native-select.tsx`.**
`components/ui/select.tsx` exists, is unused on purpose, and a test asserts that
nothing under `app/` or `components/` imports it.

Why a styled native element instead of the shadcn custom listbox:

1. Every dropdown is registered with react-hook-form, which needs native form
   semantics and a real form value.
2. This is a BPO app used mostly on phones. `<select>` opens the platform picker —
   the wheel on iOS, the sheet on Android. A custom listbox would be visually
   identical on desktop and materially worse on the device most of the workforce
   uses.

So the element stays native and the **styling** is standardised, which was the
actual inconsistency. The first sweep found 26 dropdowns across 22 files, each
having drifted to `rounded-[10px]` or `rounded-[12px]` against Input's 16px, using
`bg-mist/50` or `bg-white` at random, and — the part that mattered — **none of them
had a focus ring at all**. Keyboard users could not see where they were in a form
full of dropdowns.

`nativeSelectClassName` mirrors `components/ui/input.tsx` deliberately: same radius,
same border, same focus treatment, same `text-base md:text-sm`, same disabled and
`aria-invalid` treatment, same `[@media(pointer:coarse)]:h-11` floor. **If you change
one, change both** — and change the test that asserts they match.

- `NativeSelect` — labelled, id-associated, chevron placed.
- `NativeSelectCompact` — filter-bar density: caption-size label above, `bg-mist/50`.

### 5.2 Tables

Raw `<table>` is a gate failure. Use `components/ui/table.tsx`. See §7.

### 5.3 Sizing and touch targets

`Input`, `Button` and `NativeSelect` each carry
`[@media(pointer:coarse)]:h-11` / `:min-h-11` by default — 44px on phones, 32px
dense controls for mouse-driven desktop. WCAG 2.5.5 minimum.

**Call sites do not add the floor.** If you need a bigger target on touch, write
`[@media(pointer:coarse)]:min-h-11` — **not** a bare `min-h-11`. A bare token has no
media query, so it forces 44px on desktop as well and silently un-does a compact
`size="sm"` or `size="icon"` variant. There are currently **87 `min-h-11` overrides
that are load-bearing** (on a plain `<Link>`, `<button>` or `<div>`, where nothing
else provides the floor — do not remove those) and **96 that widen desktop**
(82 app surfaces, 9 marketing, 5 auth). `pnpm audit:touch` classifies every site;
the 5 genuine compact-variant defects it found are fixed.

18 call sites already use the correct `[@media(pointer:coarse)]:min-h-11` form.
Follow them.

---

## 6. Layout primitives

| Component | Path | Role |
|-----------|------|------|
| `PageContainer` | `components/app/page-container.tsx` | Max-width shell (`narrow` / `default` / `wide`) + `space-y-6` |
| `PageHeader` | `components/app/page-header.tsx` | Greeting / title + subtitle. Pass `title` to override the greeting |
| `FilterBar` / `FilterSelect` | `components/app/filter-bar.tsx` | GET-form chrome for list filters; wrap in `<form method="get">` |
| `ListPager` | `components/app/list-pager.tsx` | Pagination for list pages |
| `Card` | `components/ui/card.tsx` | Content sections / mobile-first history |
| `Table` | `components/ui/table.tsx` | Dense admin/ops queues (horizontal scroll on small screens) |
| `EmptyState` | `components/app/empty-state.tsx` | Zero-data placeholder |
| `ErrorState` | `components/app/error-state.tsx` | Failure placeholder |
| `MetricCard` | `components/app/metric-card.tsx` | KPI tile |
| `StatusBadge` | `components/app/status-badge.tsx` | Status chip across attendance, leave, ticket, cash-advance, CRM, ATS, priority |
| `StageBadge` / `StageExplainer` | `components/app/recruitment/stage-badge.tsx` | Recruitment stage chip + what-it-means |
| `ConfirmDialog` | `components/app/confirm-dialog.tsx` | Confirm before irreversible / status mutations |
| `AppSidebar` | `components/app/app-sidebar.tsx` | Desktop nav (token-driven) |
| `MobileBottomNav` | `components/app/mobile-bottom-nav.tsx` | Mobile nav |

Shell: `AppShell` + sidebar + mobile bottom nav. Nav definitions live in
`lib/app/admin-pages.tsx` and role equivalents; the role-page auditor crawls the
**rendered sidebar**, so a nav entry that 403s is a failure, not a cosmetic issue.

---

## 7. Table vs Card

- **Dense queues** (tickets, leave, cash-advances, applicants, CRM leads, admin
  audit/users, client attendance, employees directory): `Table` + `StatusBadge`.
- **Employee/client mobile-first history** (e.g. "my leave request" cards): `Cards`
  remain correct.

`components/app/attendance/attendance-heatmap.tsx` was the one raw `<table>` left; it
now uses the Table primitives and derives both its class and its swatch from a
single `KIND` map, so a kind can never have a class but no colour.

---

## 8. Spacing, motion, icons

- Spacing: `space-y-6` page stacks, `gap-4` grids, `p-4` card content.
- Motion: 150–300ms, ease-out (`--ease-out`). Dialog enter ≤200ms with zoom-in and
  centre transform-origin; exit is faster. Create flows stay **inline** with Reset —
  do not invent modal creates. Respect `prefers-reduced-motion`.
- Icons: Tabler at `stroke={1.75}` in app chrome.
- Marketing `site-header` is sharp and solid — no frosted glass or backdrop blur.

---

## 9. Enforcing this

```bash
node scripts/audit-design-system.mjs
```

Exit 1 on: a raw `<select>` or `<table>` outside `components/ui/`, or a colour
literal outside the allowlist. Exit 0 otherwise, with arbitrary radii reported as
informational.

It runs as a gating step in `node scripts/verify-all.mjs`, so it is not something
anyone can forget to run.

`tests/design-system-contract.test.ts` (24 cases) guards the guard:

- 8 **negative controls** that run the real script against throwaway fixtures that
  each violate exactly one rule and assert it *fails* — raw select, raw table, hex
  literal, `rgba()` literal, comment-only mentions, `components/ui/` exemption,
  serialized-output allowlist, and that arbitrary radii do **not** fail.
- The live-repo assertion: 0 raw primitives, 0 hardcoded colours, exit 0.
- The `NativeSelect` ↔ `Input` mirror contract, including the coarse-pointer floor.
- The assertion that nothing imports the unused shadcn `Select`.
- The `Card` subtree contract (§3), including a negative control that rejects a bare
  `text-sm` even when `sm:text-sm` is present.

An auditor that cannot fail is worse than no auditor, because it gets trusted. That
is why the negative controls exist: nine of those 24 cases exist only to prove
something says "no" when it should.

---

## 10. Principal QA — UI consistency bar

Audited hubs (CRM, tickets, client portal, my workspace, CMS) should:

- Use `PageContainer` + `PageHeader` + `EmptyState` for zero-data / flag-off states.
  Never a blank page. Permission denials render `forbidden.tsx` carrying
  `data-page-status="forbidden"`, so the responsive auditor reports `DENIED forbidden`
  instead of scoring a 403 as a pass.
- Keep primary actions at the 44px coarse-pointer floor.
- Prefer `ConfirmDialog` for status and irreversible mutations.
- Staff list pages may use a silent `.limit` until pagination UI ships.

---

## 11. Change history

| Date | Change |
|------|--------|
| 2026-09-13 | Token table, layout primitives, QA bar |
| 2026-10-08 | `NativeSelect` primitive created; 26 raw dropdowns across 22 files migrated; raw `<table>` eliminated; semantic status + series + sidebar token layers added; 12 hardcoded-colour files tokenised; `scripts/audit-design-system.mjs` created and wired into `verify-all`; `[@media(pointer:coarse)]:h-11` restored to `NativeSelect` |
| 2026-10-12 | Palette rebased onto the reference brand; `audit-contrast.mjs` created (sRGB-corrected ratios, real-pixel sampling over photos); `audit-typography.mjs` created and the body face split by surface — DM Sans on marketing/auth, Inter in the app |
| 2026-10-12 | Contrast gate fixed: `measured.failures` was assigned from the photo-sampling list only, so every DOM-composited failure was computed and then discarded. Both gates extended to the 44 signed-in app routes |