# Changelog

Phased delivery of the Beepa BPO platform (not semver releases).

## The header logo was still the old brand (2026-10-13)

**Found while verifying the deploy, not by reading the code.** With the redesign live I
screenshot `beepabpo.com` and sampled the shipped rasters instead of trusting the pipeline that
produced them. Same defect as the favicon, one order of magnitude more visible.

### What was actually on every page

`public/brand/beepa-logo-horizontal.png` is the logo in the header of every marketing page and
the sidebar of the product app. Sampled: **46.8% `#1f2058`** and **11.4% `#119446`** — Beepa
Navy and Beepa Green as they were *before* the palette was rebased onto the reference brand.
Also still on the dead palette:

| Asset | Where it shows |
|---|---|
| `beepa-logo-horizontal.png` | header of every marketing page, app sidebar |
| `beepa-logo-alt.png` | app sidebar mark, 32px |
| `google-organization-logo.png` / `-112.png` | Google Organization data → Knowledge Panel |
| `images/og.png` | LinkedIn / X / Slack / iMessage share card |

The rebase changed `app/globals.css` and `landing.css`. It never touched a single raster, so the
CSS-driven surfaces moved to the new brand while every image-driven logo stayed behind. This is
the blind spot of doing a palette migration in the token layer alone.

### `scripts/recolor-brand-assets.mjs`

A colour substitution, not a redraw — the artwork is unchanged. Pixels near a retired brand colour
are moved toward its replacement, partially, in proportion to distance, so antialiased edges keep
their coverage instead of banding. Everything further than 26 per channel from every retired
colour is left alone: the photography, the greys, and the antialiased halos.

Lime is deliberately absent — it did not change between palettes. 339 of ~82,000 pixels in the
wordmark remain within tolerance of the old navy; they are edge halos, not visible colour.

`--preview` writes to `.shots/brand-preview/` instead of in place, so the result can be looked at
before it replaces the shipped asset.

Worth noting: `google-organization-logo.png` turned out to be the **same "connected growth" mark
geometry as the favicon**, now on the same tokens — so the tab icon, the Knowledge Panel and the
app sidebar icon finally agree instead of being three separate crops of one idea.

### The checkout that caused it

The failure that surfaced this was in `tests/storage-rls-safe-cast.test.ts`, which asserts on
exact SQL substrings. It passed on the feature branch and failed on `main` with a content-shaped
error message about a migration that had not changed.

`core.autocrlf=true` with no `.gitattributes` meant `git checkout main` re-materialised files with
CRLF. `"public.has_permission('billing.read')\n"` no longer matched anything, so the test's
`expect(regressed).not.toBe(fixRaw)` guard reported that its own mutation had not applied. The
guard was right and the environment was wrong — a good outcome, because that assertion exists
precisely to catch a mutation that silently does nothing.

`.gitattributes` now pins `* text=auto eol=lf`, so the working tree is identical on Windows,
macOS, Linux and CI. `git add --renormalize .` confirmed no blob in the repository actually needed
changing — the corruption was purely in the working tree.

No workflow, route, or server-action behaviour changed.

## The contrast gate was reporting nothing it had measured (2026-10-12)

**The previous entry's contrast and typography figures were produced by a gate that could not
fail.** Everything below follows from that, and it is the most consequential defect found in
this pass.

### The blind spot

`scripts/audit/audit-contrast.mjs` measured every text element in the browser, computed a ratio,
and pushed anything under threshold into `measured.failures`. It then assigned:

```js
failures: sampled.filter((s) => s.sampled && !s.pass),
```

`sampled` is populated **only** from `measured.unresolved` — the over-photo probes. So every
DOM-composited failure was computed and then discarded on the floor. `measured.failures` was
never referenced anywhere in the file. The gate could only ever report failures it discovered by
sampling pixels behind text over photography; plain text on a solid background could sit at
**1.66:1** and the run would print `PASS`, `proven failures: 0`, and
`unreadable colours: 0`.

This survived the previous entry, which reported the gate finding five real contrast defects
here. Those five were all text over photographs — the one path that worked.

### How it was found

By mutation, not by reading. Setting `--color-slate` to `#c9c9c4` paints the app sidebar and its
nav links at **1.66:1 on white**, 99 elements on `/app/admin/users` alone. The gate reported zero
failures. Instrumenting it showed the ratio was computed correctly and correctly discarded.

**The first mutation attempt proved nothing, and nearly got mistaken for the gate being fixed.**
`--muted-foreground` was mutated first. It shipped, and the gate still reported zero failures —
because nothing in the product app paints that token. The app's secondary text uses
`text-slate` → `--color-slate`. A mutation that changes a value the code does not read proves
nothing about the check; "the mutation did not fail" is only evidence when the mutation is
confirmed to have reached the thing under test.

### What the fixed gate found

Two real defects on the landing page, both the same mistake: **`#008338` used as a text colour
on a tint.** It measures 4.88:1 on white and 4.67:1 on the page — a good *fill* — but 4.35:1 on
mist and 4.28:1 on `--accent`, under the 4.5 that 8–16px text requires.

| Element | Was | Now |
|---|---|---|
| `.status` (8px, on `--accent`) | `#008338` → 4.28:1 | `--color-green-strong` |
| `.section-number` (10px, on mist) | `#008338` → 4.35:1 | `--color-green-strong` |
| `.platform-item span` (16px, on mist) | `#008338` → 4.35:1 | `--color-green-strong` |
| `.dialog-success` (12px, on `--accent`) | `#008338` → 4.28:1 | `--color-green-strong` |

`.dialog-success` is fixed by inspection rather than by evidence: it renders inside a dialog that
is closed during a crawl, so no gate can see it. It is the identical pattern on the identical
tint, and leaving it would have been shipping a known failure one interaction away.

### The product app is now measured

Both gates previously walked public and auth routes only, and both wrote `NOT COVERED — routes
need a session` into their own evidence. Honest, but it left the densest surface in the product
unguarded by any gate. `scripts/audit/lib/app-session.mjs` signs in through the real `/login`
form as `owner` and crawls all 44 static app routes.

- **Contrast:** 13 public + 44 app = 57 routes, 5283 elements (4425 in the app), 50 over-photo
  probes, 0 failures.
- **Typography:** 9 public + 44 app = 53 routes, 4007 body-copy elements (344 public, 3663 app),
  0 strays.

The two greens' split — which is load-bearing, not cosmetic — held across the whole app: Inter
everywhere in the product, Manrope on every display-face element.

`/app/dashboard` was removed from the contrast gate's anonymous route list. It cannot render as
itself without a session, so that row was measuring the login page under an app route's name and
duplicating the `/login` row above it. It is now measured properly, signed in.

### Coverage that is declared, not implied

Absent `DEMO_PASSWORD` is an environment fact, recorded as a gap in the evidence and printed as
`NOT COVERED`. Credentials that exist but do not land are a **hard failure**, and a signed-in
crawl that gets thrown back to `/login` stops the run rather than measuring the login page again
and filing it as app coverage. A crawl that fetched app routes but found no elements is treated
as the broken measurement it is.

### Mutation-proved, both directions

- `--color-slate` → `#c9c9c4`: **1394 elements** named at 1.66:1 across the app, exit 1.
- `font-marketing` added to the app shell: **1990** wrong-face elements, exit 1.
- Both reverted and rebuilt; both gates green.

One race had to be fixed to get there: the app redirects on mount, and `/app` bouncing to
`/app/dashboard` destroys the execution context of whatever `evaluate` is in flight, which killed
the run at the first app route. Measurement now waits for the URL to settle and retries.

Verified: **10/10 fast-tier QA**, 651 tests / 87 files, `tsc` clean, production build compiles.
Contrast 5283 elements / 0 failures / 0 unreadable; typography 4007 body-copy elements /
0 strays; both with `appCoverage.covered: true` for 44 routes.

No workflow, route, or server-action behaviour changed.

## The public site now speaks one voice (2026-10-12)

**No workflow, route, or server-action behaviour changed.** Typography, plus the document
consequences of the palette and typography work.

### The seam, and why the answer was a split rather than a winner

The supplied reference sets its body copy in DM Sans. `Branding/01_MASTER_BRANDBOOK.md`
assigns Inter to "body copy, forms, tables, dashboards, CRM". Both are in-repo sources and
they disagreed — and the landing page, being a port of the reference, was the only route that
followed it. Navigating from `/` to `/about` changed the typeface. Every gate in the repo was
green throughout.

Picking one winner would have made one of those surfaces wrong. Splitting by *surface* makes
neither wrong:

- **DM Sans carries marketing and auth.** The whole public voice, where nothing is dense and
  the reference is the spec. Sign-in is the first screen a prospective client meets, so it
  belongs to the same voice.
- **Inter stays in the product app,** where 12–14px tables, payroll and CRM are the working
  surface and Inter's legibility at those sizes is the reason the brandbook names it.

Headings are Manrope on every surface already, so this was the only axis in play.

Applied as a `--font-marketing` token on the `(marketing)` and `(auth)` layouts rather than
per page, so a new route in either group inherits it. The `(auth)` group had no layout at all
— it exists now and carries nothing but the font, because `AuthShell` and
`EmployeeAuthShell` already own all the chrome. `landing.css` now resolves `--lm-sans` to the
same token instead of naming `--font-dm-sans` directly.

`Branding/01_MASTER_BRANDBOOK.md` §10 and `docs/DESIGN_SYSTEM.md` §1–2 are updated: both
carried the old hexes and the old body-font rule, and a design document that disagrees with
the tokens is the same drift this pass exists to remove.

Three more spec documents still carried the pre-unification hex tables and were rebased in the
same pass — 42 values across `Branding/BeePA_COMPLETE_BRANDBOOK.md`,
`BeePA_LANDING_PAGE_IMPLEMENTATION_PLAN.md` and `system/BeePA_MASTER_FULLSTACK_SUPABASE_PROMPT.md`:

| Token | Was | Now |
|---|---|---|
| Beepa Navy | `#1F2058` | `#1F1C4F` |
| Beepa Green | `#119446` | `#008338` |
| Deep Ink | `#17182B` | `#13161C` |
| Slate | `#667085` | `#5E6066` |
| Soft Gray | `#EAECF0` | `#D8D8D3` |
| Mist | `#F5F7F6` | `#F2F2EE` |
| Soft Green | `#EEF7E8` | `#EAF3E2` |

Every occurrence was checked to be the same token before the rewrite — these are spec tables
that describe the brand, not incidental colour samples. `#93C63D` is absent from that list
because lime did not change. `docs/QA_REPORT.md` and the `principal-system-finish-suite/`
reports still name the old values and are left as history: they record what a run measured on
a given day, and rewriting them would make them untrue about that run.

### `scripts/audit/audit-typography.mjs`

Nothing asserted which face a surface uses, which is why the seam survived. This gate walks 9
routes and requires DM Sans on every body-copy element below 24px that has not opted into the
display face, with Manrope on headings and `font-display` elements. 344 body-copy elements
across the landing page, five marketing routes and four auth screens; 0 strays.

Proven by mutation: reverting the marketing layout to `font-sans` produces exactly 123 strays
and exit 1 — the same 123 body-copy elements the clean run counts for that group.

**It had to be written three times.** Two earlier versions were wrong in the same direction and
both reported confident, specific failures about a page that was correct:

1. Reading `main p` returned Manrope on `/about` — that was an 11px eyebrow, legitimately in
   the display face, not body copy.
2. Filtering to ≥15px returned `Manrope:2 DM Sans:1` on `/login`, because the only paragraph
   over 15px there is a 21.6px rotated accent, again deliberately `font-display`.

The rule that holds is the one the markup states — an element is display type if it is heading
text (found by walking ancestors, because `app/globals.css` applies `font-display` to h1–h4 in
the base layer rather than on the element) or opts in explicitly; ≥24px is display by
definition; everything else must be the surface's body face. A check that samples one
"representative" element and calls it the surface's font will be wrong about the surface in
both directions, and will look authoritative while doing it.

**Same coverage gap as the contrast gate:** the product app is not measured, because `/app`
routes need a session. The contract it checks is stated in the evidence file rather than left
implicit.

Verified: **10/10 fast-tier QA checks**, 651 tests / 87 files, `tsc` clean, production build
compiles, `responsive-public` 80/80, design-system audit clean, contrast gate 888 elements +
59 over-photo probes with 0 failures, typography gate 344 body-copy elements with 0 strays.

## One palette: the landing page's brand became the system's brand (2026-10-12)

**No workflow, route, or server-action behaviour changed.** This is a token-layer change plus
the documentation it corrects.

### The site had two palettes, and the landing page's was the reference

`components/landing/landing.css` declared the entire reference palette as `--lm-*` on its
wrapper and then re-pointed `--background`, `--foreground`, `--primary`, `--secondary`,
`--accent`, `--muted-foreground`, `--border`, `--ring` and `--destructive` at them — so the
shared `Button` and `Dialog` primitives adopted the reference palette without any of their
own class strings changing. It worked, and it was the wrong shape:

- Every colour had to be written twice, and nothing reported the second copy.
- The landing page was not *using* the system brand; it was running a parallel one that
  happened to look right on one route.
- A contrast fix applied to `--primary` would have moved the landing page and left the other
  thirteen routes, auth, and the entire product app exactly where they were.

The reference values now live in `app/globals.css` as the system values. `landing.css`
consumes `--primary`, `--border`, `--color-navy`, `--muted-foreground` and the rest directly —
all ~100 references — and declares no colour of its own. Only the DM Sans body stack and the
display stack remain landing-local.

| Token | Was | Now |
|---|---|---|
| `--background` | `#ffffff` | `#fafaf8` |
| `--foreground` / `--color-ink` | `#17182b` | `#13161c` |
| `--primary` | `#0b6e34` | `#008338` |
| `--color-navy` | `#1f2058` | `#1f1c4f` |
| `--color-green` | `#119446` | `#008338` |
| `--color-slate` / `--muted-foreground` | `#667085` | `#5e6066` |
| `--border`, `--input`, `--color-line` | `#eaecf0` | `#d8d8d3` |
| `--color-mist`, `--secondary`, `--muted` | `#f5f7f6` | `#f2f2ee` |
| `--accent`, `--color-soft-green` | `#eef7e8` | `#eaf3e2` |
| `--destructive` | `#b42318` | `#c62b2f` |

Cards stay `#ffffff` against the warm page, which is what the reference draws and what
stopped the surfaces reading as one flat field.

### The one deliberate deviation

`--destructive` is `#c62b2f`, not the reference's `#d73337`. The reference red is AA on
white (4.75:1) and on the page background (4.55:1) but drops to **4.16:1** on
`--color-critical-surface` — which is precisely the surface error text is drawn on. One step
down the same hue gives 4.85:1 at worst across white, page, secondary, accent and the
critical surface.

`--color-green` vs `--color-green-strong` is the same kind of split, and the rebase makes it
load-bearing rather than decorative: `#008338` is 4.88:1 as a fill under a white label but
only **4.27:1 as text** on a tinted surface. It is a fill colour. Textual green is
`--color-green-strong` at 6.37:1.

### Two scrims, because the guarantee has to hold where the text is

`--scrim-photo` is an even floor starting at 0.82 opacity, which is where arithmetic puts
it: light copy needs the backdrop at or below 0.173 luminance, and holding that against a
bright photograph requires `a >= 0.82`. The landing service cards need it that high because
their content starts ~67% down a 360px card.

The hero does not. Its only copy is a caption across the bottom ~10%, and running the same
even scrim over it darkened the entire photograph for no legibility gain. `--scrim-caption`
is bottom-weighted instead — 0.16 at the top, clearing 0.82 by 85%, where the caption
begins. The hero photograph is bright again and its caption is still AA.

### A documented ramp entry that could not be drawn

`--color-series-5` pointed at `--color-lime`, which measures **1.68:1** on a white card and
under 2:1 on every light surface in the system. The fifth entry of the categorical ramp was
undrawable. Nothing assigns it today (attendance uses series 1–4, the weekly chart uses 1),
so this was a trap rather than a visible bug — but it is exactly the drift this pass exists
to remove. It is now `#7a3f9d`, 5.76:1 at worst. Lime stays a brand accent, where it is
7.77:1 on navy; it is only useless as a mark on a light field.

### The header had its own copy of the palette

`.site-header` — the one element every marketing page renders — hardcoded `#ffffff` and
`#eaecf0` in the rule *and* in the `header-solid` keyframes. It is a token now. The
design-system audit only scans `app/` and `components/`, so it never saw this; the colour
change is what made it visible.

Verified: **9/9 fast-tier QA checks**, 651 tests / 87 files, `tsc` clean, production build
compiles, `responsive-public` 8/8 viewports, design-system audit clean. The contrast gate
re-measured every surface against the new palette: 888 elements plus 59 over-photo probes
across 14 routes, 0 failures.

**One coverage gap worth naming:** the contrast gate's route list includes `/app/dashboard`,
but that route redirects to `/login` when unauthenticated — so the product app's own surfaces
are not covered by it. Status and series colours were checked arithmetically against the new
surfaces instead, which is how the series-5 finding surfaced. Extending the gate to sign in
first is the real fix and is not done.

### A gate that quietly deleted its own evidence

`audit-responsive.mjs` defaults to `["/"]` when no route arguments are given — correct for
"is the landing page fine on a phone", wrong for regenerating a committed file. Run bare
during this pass, it produced 8 route-viewport combinations, wrote them to
`responsive-public.json`, and replaced an 80-combination file. It printed **"8/8 clean"** at
the bottom. Nothing said nine routes had just been dropped, and the diff read as
`4 insertions, 1021 deletions`.

It now refuses before opening a browser: if the file on disk covers routes the run does not,
it names them and exits 1 in under a second. Proven both ways — bare invocation against the
80-result file names `/about, /services, /why-beepa, /contact, /privacy, /terms,
/case-studies, /careers, /resources` and exits 1; the explicit ten-route invocation restores
80/80.

`qa-run-all.mjs` already registered this check with all ten routes spelled out, so the
registry was right and the ad-hoc invocation was the anomaly. That is the general shape of
this class of bug: a check result written to a file is a claim, and a claim that covers less
than the one it replaces is worse than no claim, because it reads as fresh evidence.

Verified: **8/9 fast-tier QA checks with `client-invite` BLOCKED** by the environment's
single-invite email budget (not a regression; the runner diverted that attempt to
`client-invite-blocked.json` and left the earlier passing evidence untouched), 651 tests /
87 files, `tsc` clean, production build compiles, `responsive-public` **80/80** across ten
routes × 8 viewports on the new palette, design-system audit clean, contrast gate 888
elements + 59 over-photo probes with 0 failures.

## Contrast is now measured, and five defects it found were invisible (2026-10-12)

**No workflow, route, or server-action behaviour changed.** This is a measurement and
rendering fix: a new runtime gate, and the corrections it forced.

### The recorded contrast figures were wrong by roughly a factor of two

Every palette ratio in this project was a number typed by hand into a document, computed as
`0.2126·r + 0.7152·g + 0.0722·b` over **non-linearised sRGB values**. That is a weighted
average of gamma-encoded channels, not WCAG relative luminance. Checked against the two
published sentinels it fails both: `#767676` on white comes out 2.05:1 instead of 4.54:1,
and black on white comes out 3.00:1 instead of 21:1.

The consequence was not cosmetic. It had the reference palette marked as unusable:

| Colour | Recorded | Actual |
|---|---|---|
| Reference primary `#008338` on white | 2.39:1 ✗ | **4.88:1 ✓** |
| Reference muted `#5e6066` on page bg | 2.41:1 ✗ | **6.01:1 ✓** |
| Reference destructive `#d73337` on page bg | 2.65:1 ✗ | **4.55:1 ✓** |
| Repo `--primary` `#0b6e34` on white | 2.75:1 ✗ | **6.37:1 ✓** |
| Repo `--muted-foreground` on white | 2.16:1 ✗ | **4.97:1 ✓** |

**Correction to the entry below:** it states that `--primary` was *deliberately not copied
from the reference* because that value "is 3.2:1 on white and fails AA for text". It does
not fail. The reference primary is AA at 4.88:1 as a fill with a white label and 4.67:1 as
text on the page background, so that exclusion was an accessibility decision taken against
a number that was never true. The darkening the repo still ships is harmless, but it was
not required and the reasoning recorded for it should not be trusted again.

### `scripts/audit/audit-contrast.mjs`

A runtime gate over 14 routes. It resolves each element's effective background by
compositing `background-color` up the ancestor chain, folds in alpha and group `opacity`,
resolves the threshold from computed size and weight (4.5:1 normal, 3:1 at ≥24px or ≥18.66px
bold), and skips what WCAG exempts. Text over photography cannot be answered from the DOM
at all, so those elements get a real-pixel measurement instead.

### Five defects, four of them invisible to a reader

- **Every heading on a dark surface was painted in the wrong colour.** `globals.css` applies
  `font-display text-navy` to `h1, h2, h3, h4` in the base layer, which is a `color`
  declaration on the heading itself. The reference colours *containers*
  (`.service-card-content`, `.final-copy`, `.careers-band`) and lets the heading inherit — so
  a declaration on the element always won. Measured at **1.00:1** on the careers band (navy
  on navy), the three service cards, the final-CTA headline and the "why Beepa" headline.
  These were not low-contrast; they were the same colour as their background.
- **`/services` body copy at 3.71:1.** `text-slate` with `opacity-90` on a `--color-soft-green`
  card. The base token at full strength is 4.53:1 there; the ten percent fade is what broke it.
- **The footer CTA at 3.93:1.** The only marketing CTA resting on brand green rather than
  `--green-strong`, and the only one whose hover ran the other way — light at rest, dark on
  hover, the inverse of all six others.
- **Auth brand-panel copy on raw photography.** The panel faded the photo to white from the
  left and set the copy in navy and Slate on top. The fade is near-transparent by the time
  the text block ends — roughly 80% across a panel that is only ~450px wide — so the
  description sat on a mid-grey photograph at **1.38:1** and the eyebrow on a blue cast at
  1.00:1. `EmployeeAuthShell` was a byte-identical copy with the same defect.
- **The photo scrim was a vignette, not a guarantee.** `--lm-photo-scrim` ran
  `transparent 50% → navy/78% 100%`. `.service-card-content` is pinned to the bottom of a
  360px card but is ~95px tall, so its first line lands at ~67% down, where that gradient is
  ~27% opaque — measured 3.86:1 and 4.42:1 for 10px text. The floor is now derived rather
  than chosen: light copy needs the backdrop at or below 0.173 luminance, which for a bright
  photograph requires ≥0.82 scrim opacity. It starts there and still ramps to 0.94, so it
  holds for any crop of the photo, including a future, brighter one.

The auth panels were rebuilt on the brand's own photo language — navy scrim, light copy, lime
accent — which is what the mobile strip beneath them already did. Fixing the contrast and
unifying the surface turned out to be the same change.

### Three ways the gate itself lied first

Each produced a confident, wrong answer, and each is now structurally prevented:

- **Glyph exclusion let antialiased edges through.** The first over-photo implementation kept
  every pixel more than a small distance from the foreground colour and discarded the rest.
  Antialiased glyph edges are further away than that, so they were treated as backdrop and
  every case returned 1.00:1 — a number no real text/backdrop pair produces. Since colour is
  not a layout property, the gate now makes the glyphs transparent and photographs what is
  actually behind them.
- **Smooth scrolling corrupted every screenshot.** The landing page sets
  `html:has(.beepaLanding) { scroll-behavior: smooth }`. Playwright scrolls an element into
  view before clipping, so the shutter opened mid-animation and captured the wrong region —
  a white button with near-black text was reported as near-black on near-black at 1.02:1.
- **A parser that silently skipped the palette.** The colour reader handled `rgb()` only. The
  landing page's palette is `oklch()`, which Chromium serialises as `lab()`, so the gate
  skipped it: `/` reported 27 elements measured, then 1 once the headings actually adopted
  the reference palette, passing both times. Colours are now normalised through a canvas, and
  **anything the canvas cannot resolve fails the run** — mutating the blind spot back in
  produces 37 unreadable colours and exit 1.

The per-route `[ok]` flag was also reading only failures and status, so a mutated run printed
`[ok]` on all fourteen routes directly above `RESULT: FAIL`. A report whose lines and verdict
disagree is worse than none, because the eye reads the fourteen `ok`s and stops.

Verified: **9/9 fast-tier QA checks**, 651 tests / 87 files, `tsc` clean, production build
compiles. The contrast gate alone measures **888 elements by DOM composition plus 59
over-photo probes sampled from rendered pixels** across 14 routes, with 0 failures, 0
unresolved probes and 0 unreadable colours.

## The landing page, auth and the whole product were redesigned onto one brand (2026-10-12)

Design and branding only — **no workflow, route, or server-action behaviour changed.**
The CMS-driven landing sections stayed editable in-app; the reference's visual language was
applied over them rather than replacing their content model.

- **Landing page rebuilt** against the reference: display type scale, panel shadows, a
  squared 88px header, and a single 1360px container. Sections are numbered `01`–`07` in
  **page order**, not import order.
- **Three new sections** carrying the reference's signature moments — an assurance strip,
  a time-zone band (Manila/London/New York/Sydney, with fixed figures labelled "Illustrative"
  and no client clock, so there is no hydration risk), and a three-word promise line
  separated by hairlines rather than cards.
- **14 copy-pasted CTA blocks collapsed into one `MarketingCta` primitive.** An audit proved
  all seven primary class strings were byte-identical and all seven secondaries too, so this
  was copy-paste rather than seven independent decisions.
- **Every auth page was rendering its own copy twice.** `AuthShell` and `EmployeeAuthShell`
  overlay live HTML on a photo, but pointed at poster assets with that same text baked into
  the pixels — six pages showed every line once translatable and once as paint. Now clean
  photography, and `imageSrc` documents that it must not contain text.
- **One corner language across the entire system.** Square corners moved into the shared
  primitives (`button`, `input`, `textarea`, `select`, `card`, `badge`, `dialog`, `sidebar`,
  `tabs`, …), which squared ~80 app pages without touching a page file. Avatars, the progress
  bar, switch and scrollbar stay circular: that shape carries meaning, not branding.
- **The last serif is gone.** The auth photo accent was an inline
  `fontFamily: Georgia, …`, which also silently overrode its own class. It is now `font-display`.
- **`--primary` was deliberately *not* copied from the reference.** That value is 3.2:1 on
  white and fails AA for text; this repo darkened it for that reason. Copying it would have
  been an accessibility regression dressed as fidelity.
  **Superseded — the 3.2:1 figure was wrong.** See the entry above: the reference primary is
  4.88:1 on white and passes AA comfortably. The stated reason for excluding it does not
  hold; the value left in place was not the only one that would have worked.

**Two gates caught what the unit tests could not:**

- `responsive-public` had been passing on **stale evidence** — the committed JSON predated the
  hero rebuild and the new sections, so it had never validated the redesigned page. Run for
  real, it found 5 failures on `/`: three new sections authored at 13px/11px against a ≥16px
  rule, and a 40px hero CTA with no coarse-pointer floor against a 44px touch target.
- `final-cta.test.ts` asserted on **source text**, so extracting the CTA failed a test whose
  intent was still satisfied. It now asserts on rendered markup via `renderToStaticMarkup`.

Verified: **14/14 QA checks**, 667 tests / 94 files, `tsc` clean, production build compiles —
including `role-sweep` across 13 roles and `responsive-app` across 28 routes × 8 viewports,
which are what prove the product-side corner change cost nothing.

## The square pass reached the files the primitive sweep could not (2026-10-12)

The previous entry squared the shared primitives and then 28 `app/` pages. That left
**25 component files** still carrying hardcoded corner radii from the pre-redesign
design — marketing sections, the layout shell, the install prompt and eight app forms.
They were invisible to the earlier verification because they are *leaf* components:
no page file changed, so no page-level check had anything to notice.

- **The calendar was squared by setting one variable, not by editing fourteen call
  sites.** `rounded-(--cell-radius)` appears on the day cells, the month/year triggers
  and the selected-range edges; `[--cell-radius:0px]` on the container resolves all of
  them at once.
- **`ResponsiveImageFrame` had no callers, and squaring collapsed its three `frame`
  variants into one.** `interlocking`, `soft` and `blend` differed only in corner radius
  and a responsive override, so removing the radius made them identical. The variant
  names are kept so call sites keep compiling; the doc comment, which still described
  the frames as "brand corners / rounded / large rounded", was corrected.
- **A sweep of the whole tree now leaves exactly four radius tokens**, all intentional:
  the calendar variable (reads `0px`), `rounded-[2px]` on the chart and tooltip,
  `rounded-[inherit]` on the scrollbar thumb, and `rounded-full` for the shapes that
  are circular *because they mean something* — avatars, the lime bullet dots, the two
  recruitment status chips.

### A broken sentence that every gate passed

Screenshotting `/signup` after the sweep showed the terms-consent row rendering as
three ragged lines with what looked like stray `·` separators:

> ☐ I agree to the **Terms of** **Service** and **Privacy** **Policy.**

`components/ui/label.tsx` defaults to `flex items-center gap-2` — correct for the
common icon-plus-text label. This label's content is *running prose with two links*, so
`display:flex` made every text run its own flex item and `gap-2` inserted 8px between
"the", "Terms of Service", "and", "Privacy Policy" and ".". The separators were real
layout, not decoration. Overridden with `block` at the call site; the primitive default
is right for every other caller and was left alone.

**Every automated gate was green while this shipped** — typecheck clean, 667 unit tests
passing, a full 14/14 QA suite, and a design-system contract test asserting the radius
scale *on that same file*. All of them check that classes are present; none check that a
sentence still reads as a sentence. A scan for the shape across all 286 files found this
to be the only instance.

### The brand claim had no runtime check behind it at all

That defect is the argument for `scripts/audit/audit-runtime-radius.mjs` (`3ee8e08`).
Every check above reads class strings; none measures what a browser painted. The new
gate drives a real browser across the 12 public routes and reads computed
`border-*-radius` off every painted element, failing at >= 8px. It is the 15th check in
`qa-run-all.mjs` and `npm run audit:runtime-radius`.

It is mutation-proved, and **the first proof attempt was wrong in a way worth
recording**: mutating `components/ui/card.tsx` to `rounded-[16px]` left the gate green,
because `Card` renders nowhere on the public routes. Only after mutating
`site-header.tsx` — present on every page — did all 12 routes go red.

**Known, not done:** the gate covers public routes only. The auth-gated app UI is out
of its reach, and while `responsive-app` and `role-sweep` both walk those pages, neither
measures radius. The five marketing sub-pages are squared and covered by the gate, but
still import none of the new landing primitives.

## 70 server actions returned the driver's raw error text (2026-10-12)

- **Every `error: error?.message ?? "copy"` fallback in the codebase was unreachable
  dead code.** `??` applies only when the left side is nullish, and PostgREST always
  supplies a message — so users read `duplicate key value violates unique constraint
  "crm_leads_pkey"` and **never the words the author had already chosen**. 66 such
  strings existed and none of them had ever been displayed.
- **Three shapes existed, not one**, which is why a single pattern match would have missed
  most of them:

  | Shape | Sites | Where |
  | --- | --- | --- |
  | `error?.message ?? "copy"` | 66 | across 17 `"use server"` modules |
  | `error.message \|\| "copy"` | 1 | `lib/attendance/actions.ts` |
  | `error.message`, no fallback at all | 3 | `lib/notifications/actions.ts` |

  The third is the worst: `markNotificationRead`, `markAllRead` and
  `updateNotificationPreferences` returned the driver message outright with nothing behind
  it. `scripts/audit/apply-error-copy.mjs` refused those three rather than guessing at copy,
  and that refusal is what surfaced a shape nobody had noticed.
- **The fix invented almost no copy.** `lib/actions/error-copy.ts` exports one function:

  ```ts
  export function writeFailed(copy: string): string {
    return copy;
  }
  ```

  It returns the author's chosen copy and does not consult the error at all — the detail
  belongs in a server log, not a toast. Sixty-six sites became
  `error: writeFailed("Unable to create lead.")`, recovering 66 strings the codebase had
  already written and never used. Three were written by hand, because those actions had none.
  **No mapping table, deliberately**: classifying Postgres error classes into product copy
  would mean 70 new copy decisions about screens this change does not own.
- **The severity was wrong before the fix, and that mattered more.** An earlier commit
  recorded that these reached anonymous visitors and could leak database schema. It did not:
  it came from conflating CMS *content* (authored by an admin, rendered to visitors) with CMS
  *action errors* (shown to the admin editing). `scripts/audit/public-error-surface.mjs`
  measured it — **0 of the 18 modules sit behind a session gate**, and both genuinely public
  paths were already safe. Corrected down in the same pass rather than left standing.
- **Two guards now scan every file in `lib/`**, rejecting both `error: <expr>.message ?? …`
  and a bare `error: <expr>.message`, so a later module that reintroduces either fails the
  gate. One guard asserts the scan itself still finds the action modules, because a guard
  that silently checks nothing is worse than no guard.
- Verified: `public-error-surface.mjs` reports **0** raw provider messages, tsc clean,
  **661 tests / 94 files** (was 655 / 93), and the full 14-check suite re-run green against a
  rebuild touching 19 product modules.

## The whole suite runs in one command, and every check leaves evidence (2026-10-12)

- **First fully green run: 14/14 checks, exit 0, across all three tiers** — fast probes,
  the release gate, and the entire slow tier. `missingEvidence: []`.
  ```
  not-found 7s · dialog-keyboard 5s · command-palette 12s · notification-bell 4s
  internal-links 311s · client-invite 9s (17/17)
  responsive-app-1..4  135s/147s/149s/146s   (56/56 each, all 28 routes)
  responsive-app-cms   22s  (8/8)     responsive-public 105s (80/80)
  role-sweep          880s  (479 visits, 13 roles, 0 page errors)
  gate                16s  vitest 655 tests / 93 files, tsc clean
  ```
- **`--all` used to mean seven routes.** `responsive-app` was registered as a *single*
  entry carrying chunk 1 of 4, so the "one command to answer is the system ready" verified
  **7 of 28 app routes and none of the 10 public routes**; the other 21, `/app/cms` and the
  public surface were reachable only by copying commands out of the report by hand. The
  memory constraint that forces chunking had leaked into the registry as a half-registered
  check — the four-chunk rule was documented and enforced by whoever ran it, but the runner
  did not know there were four chunks. All four chunks, `/app/cms` and the public surface are
  registered now. Each stays a separate process, so the 2.4 GB ceiling is unchanged.
- **Three checks were writing no evidence at all.** `audit-app-responsive.mjs`,
  `audit-responsive.mjs` and `qa-exercise-internal-links.mjs` produced results that existed
  only as terminal scrollback, while every other check persisted a file. The gap stayed
  invisible precisely *because* the runner listed them as `evidence: null` — nothing flagged
  it, because nothing was asked. All three write evidence now; the runner enforces it, and
  `missingEvidence` is reported rather than tolerated.
- **`internal-links` is now `docs/evidence/internal-links-check.json`** and registered as the
  check's evidence, so its 29 link assertions are enforced rather than printed.
- **Per-check environment support added to `runCheck`** (`QA_CHUNK_LABEL`), giving each
  responsive chunk a short evidence filename the registry can name in advance instead of a
  route-derived slug.

## 83 of 83 server actions are now exercised end to end (2026-10-12)

- **`inviteClientUser` — the last uncovered action — was driven through its real form on
  `/app/clients` and passed 17/17, exit 0**: auth user created, profile carrying the names
  typed into the form, a `client` membership pointing at the organization the form selected,
  marked `invited` not `active`, carrying the `client_admin` role scoped to `client`, and
  **an invited user cannot sign in with a password before accepting**. That last one is
  what gives the run its meaning — a run that only asserted "a user was created" would pass
  with the portal reachable by anyone holding the invite address. Recorded in
  `docs/evidence/client-invite-check.json`: `failures: 0`, `blocked: false`,
  `cleanupVerified: true`.
- **The cleanup then crashed and left the whole thing behind**, which is the finding worth
  keeping. `membership_roles` is a join table keyed by `(membership_id, role_id)` and has
  no `id` column; the cleanup selected `id`, `must()` correctly threw, and **because the
  four deletes sat unguarded after it, none of them ran**. A real auth user, profile,
  membership and role row were left in the live database — the same residue defect fixed
  once in the product, reintroduced in the harness. Fixed three ways: delete role rows
  straight by `membership_id`; wrap each cleanup step so one failure cannot abort the
  rest; and make a run whose cleanup did not complete **exit 1** instead of 0.
- **The first successful run still was not a recorded result.** Its cleanup crashed between
  the assertions and the `writeFileSync`, so the evidence file kept reading BLOCKED from a
  later attempt. It was **not** hand-edited — writing in the result of a run that crashed
  would defeat the rule this project has held throughout, even though the proving run was
  known to be good. The re-run above is what closed it, and it confirmed the cleanup fix on
  a run that actually had something to clean up.
- **The environment's email budget allows roughly one invite per window**, so a successful
  run is followed by immediate BLOCKED attempts. A blocked attempt costs nothing; do not
  probe before exercising, since probing spends the invite.

## All three invite paths created the account before checking the role (2026-10-12)

- **Every invite action ordered its steps wrongly, in the same way.**
  `inviteClientUser` (`lib/clients/actions.ts`), `inviteInternalUser` (`lib/admin/actions.ts`)
  and `convertApplicantToEmployee` (`lib/recruitment/actions.ts`) all call
  `inviteOrResolveAuthUser` — which creates a real auth user **and sends a real invitation
  email** — and only then looked up the role, upserted the membership and inserted the
  membership role. The role lookup is a cheap local read that sat *after* two irreversible
  steps. Any failure from that point on left an **orphaned auth user and an invitation for
  access that did not exist**, while reporting "role is not configured" to the caller.
- **The `profiles` update discarded its result**, so a failed profile write reported
  success and left a provisioned user with no name. The hire path discarded the same way
  on its `applicants.profile_id` link.
- **The role lookup now runs before anything irreversible**, and every post-invite failure
  rolls the account back. The rollback is gated on `invited === true` and the gate is
  asserted in test, because `invited` is `false` whenever the helper resolved somebody who
  already had an account — deleting on that path would destroy a colleague's login to tidy
  up a failed membership write. The one failure that deliberately does **not** roll back
  is the self-service baseline grant in `inviteInternalUser`, where the membership and
  primary role already exist and the account works.
- **The failure surfaced GoTrue's raw string to the user.** A toast read
  `email rate limit exceeded` — the provider's internal name for HTTP 429, shown verbatim
  to an org admin. `lib/auth/error-messages.ts` already holds four sibling mappers over one
  shared `authFailureKind`, and its header comment names this exact drift as the failure it
  exists to prevent: *"so the next mapper added cannot invent a fourth reading of a status
  that three others already agree on."* The invite path **was** that fourth reading, and the
  only one returning `inviteError?.message` unmodified. `inviteErrorMessage` now joins the
  family; its signature accepts `message?: string` and never reads it. The rejected branch
  says nothing about whether an address is registered, because the caller intercepts
  "already been registered" before the mapper is reached.
- **Fixing the copy broke my own test, and that is recorded too.**
  `qa-exercise-client-invite.mjs` decided success by matching a blacklist of words against
  the toast (`/unable|error|rate limit|invalid|…/i`). That worked only because the raw
  GoTrue string contains "rate limit". The new copy — *"Too many invites have been sent
  from this network. Wait a moment, then try again."* — matches none of them, and the
  harness reported **PASS on an invite that had been refused**. It now asks one question,
  *did an auth user appear?*, and prints the toast beside the verdict. Copy is not a
  signal; a check that must be edited whenever someone improves the wording is measuring
  the wording. Re-run against the live build with the quota closed it correctly reports
  BLOCKED and exits 2.
- **Verified end to end, not only in unit tests:** the rebuild and re-run above is what
  produced both the old and the new toast text.
- Gate: **655 tests / 93 files** (was 634), tsc clean. 11 new tests written red first across
  `tests/auth-error-messages.test.ts`, `tests/client-invite.test.ts`,
  `tests/admin-invite.test.ts` and `tests/hire-convert.test.ts`.
- **Still open, deliberately:** 68 sites across 18 session-gated modules return
  `error?.message` from the driver as their user-facing message. See `docs/QA_REPORT.md`
  §2 and §6 row 19. **An earlier draft of that entry claimed these were reachable by an
  anonymous visitor and could leak database schema; that was wrong.** It confused CMS
  *content* with CMS *action errors*. `scripts/audit/public-error-surface.mjs` measures it:
  **0 of the 18 files sit in a module without a session gate**, and both genuinely public
  paths are already safe — `lib/auth/actions.ts` routes through the mappers, and
  `contactAction` discards the raw message at `lib/contact/actions.ts:68`. It is internal
  copy quality, not disclosure, and the severity was corrected down rather than left
  inflated. Not fixed here — the copy decisions belong to whoever owns those screens.

## A permissive RLS policy that the product never needed (2026-10-09)

- **`public.lead_attribution` granted `WITH CHECK (true)` to `authenticated`**,
  which Supabase's linter flags as `rls_policy_always_true` (lint 0024). Any signed-in
  account — an applicant, a client-portal user, anyone with a valid session — could
  write an attribution row against **any** `lead_id`, poisoning the CRM attribution
  data that sales reads.
- **The policy was pure attack surface.** The only writer in the codebase is
  `createLeadFromContact` (`lib/crm/actions.ts:205`), which deliberately uses
  `createAdminClient()` because the public marketing contact form is submitted by an
  anonymous visitor holding no `crm.manage` JWT. `relforcerowsecurity` is `false` on
  this table, so the service role bypasses RLS and the policy contributed nothing to
  that flow. The `SELECT` policy is untouched and still requires `crm.read` or
  `crm.manage`.
- **Verified in both directions against the live database**, not just applied:
  an authenticated insert now returns **`42501 insufficient_privilege`**, while the
  service-role insert the marketing form depends on still succeeds, and an anon
  `SELECT` still sees zero rows. A fix that only demonstrates the first half would
  have shipped a broken contact form.
- **`tests/lead-attribution-rls.test.ts` pins it, after two weaknesses were found in
  it.** The first version asserted only that the `DROP POLICY` statement existed, so
  appending `create policy ... with check (true)` on the next line still passed.
  Widening it to that single migration file then exposed a second gap: a *different,
  later* migration could re-create the policy and the guard would never see it. It
  now scans every migration and asserts that none sorting **after** the fix
  re-creates the policy, either by name or via any always-true `WITH CHECK` on that
  table.
  - Widening it immediately found a real occurrence: `20260906001100_ats_crm_cms.sql`
    is the original creator of the policy. That file is applied migration history and
    must not be edited, so the invariant is forward-looking instead — the fix drops
    it, and nothing later may bring it back. **A guard that only reads the file
    holding the fix is not a guard, and one that cannot see history will fight the
    history instead of fixing the future.**
  - Negative-controlled by adding a *new* migration that re-creates the policy: both
    forward checks failed and named the offending file, then it was deleted. A second
    control, a vacuity assertion that failed because the fix is currently the newest
    migration, was replaced with one that tests the scoping mechanism itself, by
    asserting the historical creator sorts strictly before the fix and is excluded.
- **`docs/COMPLETION_LEDGER.md` was left claiming the platform was blocked** while the
  gate had been passing for hours: "CODE COMPLETE — BLOCKED ON DATA + CREDENTIALS", a
  verbatim 15/18 gate transcript with exit 1, 422 unit tests across 73 files, and both
  closed blockers still listed. Corrected, along with the stale "rotate the chat
  token" line the owner had explicitly waived. `PROJECT_STATUS.md` and
  `docs/REMAINING_WORK.md` needed the same correction for the same reason. **Fixing a
  status document is not the same as fixing the one next to it**, and a status file
  that contradicts itself is worse than one that is merely out of date, because a
  reader has no way to tell which half is current.
- **I also left three debug functions in the database** during the clause-order
  bisection (`probe_order_fn`, `probe_simple_fn`, `probe_trig_fn`) and only noticed
  because the advisor run flagged them as mutable-`search_path` security warnings.
  Dropped, and re-queried to confirm zero remain. **A diagnostic that writes to the
  system under investigation needs its own cleanup step**, because "I only created a
  probe" is not a reason it does not count as production state.

## The realtime gate was never testing realtime (2026-10-09)

- **Ship gate step 16 had been reporting "needs the realtime migration" for weeks.** Applying the migration did not fix it. The probe was subscribing with the **anon** key and then inserting a notification owned by the HR user, so it waited for an event it was structurally incapable of receiving: `notifications` carries RLS `user_id = auth.uid()` scoped to the `authenticated` role, and anon is filtered out of every row. **The step could not have passed with or without the publication.**
- **The publication was never the problem.** After the migration applied, `pg_publication_tables` already listed all 12 tables including `notifications`, and the RLS policies were exactly right. Chasing "add the table to the publication" would have been the wrong fix, applied to a table that was already there.
- **The probe now signs in as the notification's owner** and subscribes with that session, which is the case the app actually depends on. It also refuses to run if the signed-in user is not the row owner, so it cannot pass or fail for the wrong reason. Result: the event arrives, and the step reports what it claims to report.
- **A second defect sat next to it.** `test-realtime-events.mjs` read `SUPABASE_SECRET_KEY` with no fallback, unlike every other Supabase script in the repo, so it died with a bare `supabaseKey is required` whenever only the legacy key was configured. Now `SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY`, which is what the rest of the codebase does.
- **A gate step that cannot fail for the right reason is worse than no gate.** It reads as coverage, it costs a person minutes each time it goes red, and it hides the fact that the underlying capability was never verified.

## The payroll pipeline is populated by the engine, not by seed fiction (2026-10-09)

- Retiring the `stub_v1` period left the demo tenant with one finalized fortnight and an empty pipeline, which is the correct outcome and also a broken demo. `scripts/seed-payroll-window.mjs` (`pnpm seed:payroll:window`) creates the remaining September 16–30 semi-monthly window using the engine's own `salaryFactorFor` and `fixedPayAmount`: **10 draft records, ₱240,000 gross**, no overlap with the finalized fortnight.
- **The script restates the pay math rather than importing it,** because it runs as plain Node. `tests/payroll-seed-window.test.ts` closes that gap by evaluating the script's own function body and comparing it against `lib/payroll/schedule.ts` for every frequency. Changing the seed's factor from `0.5` to `0.45` fails the build with `expected 0.45 to be 0.5`, so the copy cannot drift.
- It refuses a window that overlaps an existing period using the same inclusive-inclusive comparison as the `payroll_periods_no_overlap` constraint, and refuses outright if any active employee has no `payroll_profiles` row rather than quietly seeding a zero-pay record.

## Two migration defects that only a live database could catch (2026-10-09)

- **`20260921100000` was missing from the pending list entirely.** `supabase migration list` showed **7** pending migrations, not the 4 the preflight audit reported. The discrepancy is worth recording: the preflight compares migrations on disk against the remote, but the earlier count was taken before `20260921100000` was identified as untracked-but-unapplied. Trusting the audit alone would have left a migration unapplied and the schema quietly short.
- **`20261006140000` declared a trigger function with no return type.** `create or replace function public.handle_user_sign_in() language plpgsql ... as $$` with no `returns` clause. PostgreSQL rejects it with `42P13 function result type must be specified`; a trigger function still has to say `returns trigger`, Postgres does not infer it. This migration had never been applied, so the defect was invisible until the push.
- **Adding `returns trigger` the canonical way then failed a *second* time**, with `syntax error at or near "trigger"`. That is not a PostgreSQL error, and assuming it was would have meant rewriting working SQL to chase a phantom. Bisected on the live database instead:
  - `language plpgsql` then `returns trigger` with a dollar-quoted body: **fails**
  - `returns trigger` then `language plpgsql`, dollar-quoted: **succeeds**
  - `returns trigger` with a single-quoted body: **succeeds**
  - `returns void` with a dollar-quoted body: **fails at `void`**, so it is the clause order, not the word `trigger`
  - `returns trigger` with a tagged `$fn$` body: **fails**, so it is not about `$$` being special

  The Supabase CLI's migration splitter accepts `RETURNS` only before `LANGUAGE`. The migration is now written in that order, with the reason recorded beside it so nobody "corrects" it back.
- **`tests/migration-function-clauses.test.ts` pins both traps.** It parses every `CREATE FUNCTION` head in `supabase/migrations/`, asserts each declares a return type, and asserts `RETURNS` precedes `LANGUAGE`. It carries its own vacuity guard, since "no functions found" would otherwise pass silently.
- **Both are the same lesson as the missing `pay_frequency` column:** the preflight catches what is statically visible, and only applying the migration catches the rest. The sequence that found all three was dry-run, apply, and read the real error rather than reasoning about it.

## Mojibake in shipped copy, and a scanner that cannot be fooled by the console (2026-10-09)

> This section describes corrupted text, so it names the sequences by code point rather than pasting them. A changelog that reproduces the corruption fails the very guard it documents.

- **`components/marketing/contact-form.tsx` shipped a mangled em dash** in the line "No spam [mangled] just a clear next step": one U+2014 em dash, three characters wide, because the file had been decoded as cp1252 and re-encoded as UTF-8. Nothing failed. The build is clean, the types are correct, and no test asserts on copy, so it would have shipped.
- **The console actively misleads in both directions.** Reading `20260921100000_seed_marketing_services.sql` with `Get-Content` *appeared* to show the same corruption, which looked like a third incident. A byte-level scan proved the opposite: the file holds 2 genuine em dashes, 1 right single quote, and **zero** `U+00E2`. Repairing on the strength of what the terminal printed would have "fixed" a clean file and left the real one broken. **Decide encoding repairs on bytes, never on terminal output.**
- **`tests/encoding-integrity.test.ts` now scans all tracked text.** It walks 576 files, asserts zero mojibake sequences, and asserts migrations are clean separately, because a corrupted migration writes corrupted copy into the CMS permanently and can only be corrected by a new migration, not an edit.
- **The test has controls, because "no mojibake found" is also what a broken scanner reports.** A second assertion requires a healthy count of *real* Unicode punctuation (currently 1321), so a repo stripped of em dashes cannot pass. A third asserts the scan actually visited files, so a broken walk cannot pass vacuously. A fourth excludes the test file itself, because its signature literals would otherwise make it report itself.
- **Negative-controlled.** Injecting a single corrupted sequence into the contact form failed the suite and named `components/marketing/contact-form.tsx:451`.

## I truncated `.env.local` and recovered it (2026-10-09)

- **What happened.** Appending `SUPABASE_DB_PASSWORD` with a PowerShell `StreamWriter` concatenated onto the previous line because the file ended without a trailing newline, so the key landed inside the `AUTH_SECRET` value. The repair script then rebuilt the file from a PowerShell array slice that collapsed, reducing 14 keys to 2. The file is gitignored, so there was no version to restore from.
- **What was recovered, and how.** Five `NEXT_PUBLIC_*` values were inlined into the client bundle by the last production build in `.next/static/chunks/`, and were extracted from there; `AUTH_SECRET` survived intact because the split put it back on its own line; the service_role JWT and DB password came from the operator. 12 of 14 keys are back. The VAPID public key extracted at exactly 87 characters, matching what the ship gate independently reported, which is what proved the extraction was faithful rather than truncated.
- **`VAPID_PRIVATE_KEY` was unrecoverable, so the pair was regenerated.** The public key is derived from the private key, so keeping the recovered public key would have left web-push rejecting the pair. Both were replaced with a freshly generated, verified-coherent pair, which is what restored `tests/push-notification-flow.test.ts` to 18/18. **Existing browser push subscriptions are now invalid and must re-subscribe.**
- **`DEMO_PASSWORD` was unrecoverable, so the 13 demo accounts were reset** through the admin API to a generated value, and sign-in was verified on 5 role accounts rather than assumed. `CRON_SECRET` was regenerated; `authorizeCronRequest` fails closed when it is absent, so its loss was a functional gap, not an exposure.
- **Two values remain unset and are optional:** `SUPABASE_SECRET_KEY` (every consumer already falls back to `SUPABASE_SERVICE_ROLE_KEY`) and `SUPABASE_ACCESS_TOKEN` (only needed for `supabase link`, and the project is already linked via `supabase/.temp`).
- **The lesson, recorded because it will recur.** PowerShell string surgery on a file containing secrets is not recoverable by the file itself. Every other edit in this session went through the `edit`/`write` tools precisely because of this; the one file that did not is the one that broke.

## The payroll overlap is now a guarded one-command repair (2026-10-09)

- **The overlap itself is stale news dressed as a live bug.** `scripts/audit/audit-payroll-period-overlap.mjs` reports the conflict exactly: `September 1–15, 2026` (finalized, 09-01..09-15) is fully contained by `September 2026 payroll` (draft, 09-01..09-30), and employee `108f95ff` holds a record in both, 24,500 and 26,760. The org pays `semi_monthly`, so September is legitimately two fortnights. The month-wide period is not a second payroll result at all: all 10 of its records read `engine=stub_v1`, `worked_minutes=4800`, and none carries a statutory deduction.
- **Retiring it was previously a hand-run destructive migration,** which is why it sat undone behind a go-ahead nobody could give confidently. `scripts/reconcile-payroll-period-overlap.mjs` (`pnpm fix:payroll-overlap`) makes it a reviewed command: dry-run unless `--apply`, refuses a period in `finalized`/`disbursed`/`closed`, and refuses unless **every** record in the target is `calculation_snapshot.engine === "stub_v1"`. That last guard is the whole safety argument, so it cannot be widened into "mostly stub" without failing the build.
- **The cascade is printed before anything is written,** so the cost is never a surprise: 1 period, 10 records, 30 components, 10 payslips, and **0 rows on the `ON DELETE SET NULL` legs** (`cash_advance_deductions`, `commission_records` — both would survive the delete but lose the link to the payslip that carried them, so a non-zero count halts the script unless `--allow-orphan-links` is passed).
- **One statement on the period, so there is no half-deleted state.** Deleting records or payslips by hand would leave a window where the records are gone but the period still overlaps. Postgres applies the cascade atomically; the script then re-runs the overlap test and **exits non-zero if any conflict remains**, so the repair cannot report a success it did not achieve.
- **A latent failure surfaced while writing it:** the script could not read `payroll_periods.pay_frequency` (hard `42703`), because that column only arrives with the still-unapplied `20260922120000_payroll_frequency_fixed_salary.sql`. The repair has to run *before* that migration, so it reads only columns present in every schema revision, and `tests/payroll-overlap-reconciliation.test.ts` fails the build if that dependency is reintroduced. A repair that cannot run at the moment it is needed is not a repair.
- **`process.exit()` is a crash on this machine after any Supabase query.** Probing the guards at runtime (pointing `--period` at the approved fortnight, and at a period in no conflict) produced the correct refusal messages and then died with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` and exit `0xC0000409`. Isolated with a three-way probe against this repo's own client: `process.exit(2)` after one query exits `0xC0000409`; `process.exit(0)` exits `0`; `process.exitCode = 2` exits `2`. It is libuv tearing down while undici's keep-alive socket is still closing. The practical scope is narrower than it looks and worth stating precisely: **only non-zero exits are affected, so audits that pass still exit `0` and the ship gate is unaffected** — `verify-all` itself also exits cleanly, because it drives its Supabase audits through `spawnSync`. What is affected is *diagnostic quality*: a script that refuses on purpose exits with a Windows crash code instead of `2`, so an operator cannot tell a safety stop from a broken script. That is precisely the signal this repair depends on. The reconcile script routes all exits through a `stop()` helper that unwinds the module and lets the loop drain; the guard test strips comments and fails the build on any reintroduction of `process.exit(`. **The same latent pattern remains in the other Supabase scripts** (`fix-premature-finalization.mjs`, `seed-demo-leave.mjs`, `refresh-demo-timeline.mjs`, and the Supabase-backed audits under `scripts/audit/`); they are left alone here rather than refactored blind, since none of them currently misreports a result.
- **The guards were exercised at runtime, not just in the source.** Pointing `--period` at the finalized fortnight refuses with `is 'finalized', which is approved payroll`; pointing it at a period in no conflict refuses with `is not part of any overlapping pair`. Both now exit `2`, and the dry run still exits `0`. A guard that has only been read is not a guard that works.
- **Still not executed.** It deletes rows. It is staged, dry-run verified against live data, and waiting on the same explicit go-ahead as before — but now the go-ahead covers a command whose blast radius and guards are both inspectable, not a hand-written cascade.

## A bare `signOut()` was signing users out of every device (2026-10-09)

- **`supabase.auth.signOut()` defaults to `scope: "global"`.** Confirmed in the installed `@supabase/auth-js@2.115.0`: `async signOut(options = { scope: 'global' })`, and `_signOut` forwards the scope straight to GoTrue's `/logout`. A bare call therefore revokes **every refresh token the user has, on every device**. The project already had the right shape — `logoutAllAction` passes `{ scope: "global" }` explicitly — which is what makes the bare calls an oversight rather than a decision.
- **The worst one is reachable by accident.** `employeeLoginAction` refuses a client who types their address into the employee portal, and it did that refusal with a bare `signOut()`. So a client who mistyped their email on the wrong page was signed out of their *working* client-portal session on their phone. Fixed to `scope: "local"`, which discards only the session that attempt just created.
- **`logoutAction` — the Sign out button in the app header — was global too,** so signing out on a work laptop also signed the user out of their phone. `logoutAllAction` exists precisely to be that the deliberate choice, and it was dead code: nothing referenced it. Now local, so the global path is reachable only on purpose.
- Five call sites fixed across `lib/auth/actions.ts` (4) and `lib/auth/session.ts` (1, deprecated). **`tests/auth-signout-scope.test.ts` asserts no bare `signOut()` survives**, and its scanner strips comments first: an earlier version accused the code twice because the comments written *about* the bug contain the string `signOut()`. It also asserts a global sign-out still exists, so the fix cannot be "passed" by deleting the distinction. Negative-controlled both ways.
- **A sixth, in a script the first guard could not see.** `scripts/sales-marketing-modules-smoke.cjs` signs in as a real demo user and then called a bare `signOut()` — so running that smoke test revoked that person's session on every device, including any e2e session sharing the demo accounts. Fixed, and the contract test now walks all of `lib/` and `scripts/` rather than the single file the bug was found in. **A guard that only watches the file where the bug was found guards nothing.** It names the offending file and call on failure.
- **How it was found:** the e2e suite reported 11 client failures phrased as product bugs — *"redirected away from a client"*, *"did not render a denial for a client"*. None mentioned authentication. `client.spec.ts` in isolation passed 12/12, but only when the persisted session had just been created. Bisecting the other specs one at a time identified `roles.spec.ts` alone as the trigger — it is the only spec that signs a client into the employee portal.
- **The scope value is enforced by a cascade, not just an assertion.** Reverting `logoutAction` to the default global scope was tried deliberately: the switch-account test's sign-out then revoked the refresh token in `.auth/employee.json`, and **11 of 14 tests in `app-smoke.spec.ts` failed** — including every employee route. Every later test in any project sharing that session loses its auth too. This is why `scope: "local"` there is load-bearing rather than cosmetic, and why the two new runtime tests in `app-smoke.spec.ts` ("Sign out ends the session and locks the app again", "Sign out & switch account from access-denied lands on login") exist: the source scan could not tell a working sign-out from a broken one.

## Three more harness bugs, each of which read as a product bug (2026-10-09)

- **`page.waitForURL()` defaults to `waitUntil: "load"`,** and the app shell holds realtime subscriptions that keep `load` pending indefinitely. Three authenticated viewport tests therefore timed out after the login had already succeeded. Fixed across all 8 e2e specs; `tests/e2e-waitforurl-contract.test.ts` guards it and names the offending file.
- **`locator.fill()` before hydration silently loses the value.** React re-renders the controlled input from its initial state and the characters vanish — no error. The page snapshot at failure showed the tell: the email field **empty and marked invalid** while the password field kept its value. It only reproduced under load, because a busier machine hydrates slower, and it surfaced as an auth failure because a login form was where it happened. `fillStable` in `e2e/fixtures.ts` retries until the value reads back; `selectStable` does the same for `<select>`, where a reverted choice submits a form with no leave type and then waits forever for a success message.
- **The suite spent ~37 rate-limited password grants per run.** Supabase throttles per IP, and `employeeLoginAction` reported the resulting 429 as *"Invalid email or password."* — so an infrastructure condition was investigated as a credentials bug. Two fixes: `authErrorMessage` now distinguishes 429 ("Too many sign-in attempts") and network/5xx ("We couldn't reach the sign-in service") from genuinely bad credentials; and `a11y.spec.ts` + `viewport.spec.ts` adopt the session `auth.setup.ts` already persisted instead of signing in 16 more times. `roles.spec.ts` still signs in for real — asserting where each role lands after a genuine login is its entire purpose.
- **`authErrorMessage` is behavioural, not a source scan.** It could not be unit tested where it lived: a `"use server"` module may only export async functions, so a pure helper in `lib/auth/actions.ts` would have been permanently untestable. Moved to `lib/auth/error-messages.ts`, where `tests/auth-error-messages.test.ts` asserts the actual copy — including that the 429 and bad-credential paths stay *distinct*, and that 400 still reports bad credentials so the fix stays honest.

## Applying the realtime migration would have shipped two notification defects (2026-10-09)

- **The last blocked migration was carrying bugs of its own.** The realtime step has been
  reported as "needs migration `20261006140000_realtime_and_profile_sync.sql`" for a while,
  and the obvious reading is: apply it, problem gone. Applying it as written would have
  *created* two defects, because the application already notifies in application code and the
  migration also created the same notifications as table triggers:
  - **`notify_ticket_created` would have duplicated `lib/tickets/actions.ts:91`.** Both insert
    a `ticket.created` notification for the same person — the trigger keys on
    `new.requester_user_id`, the app notifies `workspace.user.id`. Every new ticket would
    produce two rows in the notification bell and two push sends.
  - **`notify_leave_request` would have notified the wrong person entirely.** It keys on
    `new.employee_id`, which is the employee who submitted their *own* leave, and tells them
    *"You have a new leave request pending review."* The audience is the approver, and
    `lib/leave/actions.ts:129` already notifies the reviewing memberships.
- Both functions were removed before the file was ever applied, so nothing had to be
  unwound. The realtime publication changes and the `profiles.last_login_at` sync trigger —
  the parts the migration actually exists for — are untouched, which the migration preflight
  confirms independently: pending dollar-quoted bodies went 6 -> 4.
- **`tests/notification-single-path.test.ts` asserts both halves of that.** The trigger must
  be absent *and* the application-side `notifyUser` call must still exist. Removing the
  trigger without proving the app path delivers it would have turned a duplicate into a
  silently missing notification, which is worse. Negative-controlled by restoring the
  duplicate trigger.

---

## A demo ticket's SLA expired on its own and took the gate down (2026-10-09)

- **Ship gate steps 14 and 15 started failing with no code change:**
  `expected 1791525467515 to be greater than 1791525940800`. The seeded
  `tickets.sla_due_at` for `TKT-DEMO-0001` was a one-off timestamp, nothing re-armed it, and
  the deadline slid into the past about eight minutes before the run. It had been passing
  earlier the same session purely because it was still in the future.
- **The test was right and the data was wrong.** A ticket shown as a live, on-track SLA
  breach queue must actually carry a live deadline — and `/app/client` computes SLA
  compliance % from that same column, so the demo had been quietly reporting against a
  lapsed deadline too.
- **The root cause was a family, not one row.** One-shot seed scripts write demo rows with
  `Date.now()` offsets, which are correct the day they run and decay silently afterwards:

  | Script | Column | Written as |
  |---|---|---|
  | `scripts/audit/batch2-cleanup.mjs:118` | `tickets.sla_due_at` | now + 72h |
  | `scripts/audit/batch3-workflows.mjs:341` | `nte_cases.response_due_at` | now + 5d |
  | `scripts/audit/batch3-workflows.mjs:219` | `interviews.scheduled_at` | now + 2d |

  So the interview had **already** quietly become a past-dated interview — the demo was
  presenting an interview that had already happened. `scripts/refresh-demo-timeline.mjs`
  re-bases all three in one pass, scoped to rows still in flight so it never falsifies
  history (an answered NTE case or a paid invoice stays where it is).
- **One repair script, not one per symptom.** `rearm-demo-ticket-sla.mjs` was written first
  and then deleted, folded in — including the `resolved_at` / `first_response_at` reset that
  a bare timestamp re-base would have missed. `tests/demo-timeline-refresh.test.ts` asserts
  every known relative timestamp has a rule, that the single-symptom script stays gone, and
  that this is **not** wired into CI: a CI job would rewrite the demo tenant on a schedule
  nobody reviewed, which is the same objection that removed the leave-cleanup step. Run it
  as part of demo refresh via `pnpm fix:demo-timeline`.
- **How this was caught, and what it says about the gate.** It only surfaced because
  `verify-all` was run twice in a row. A gate that is sampled once a day can pass on a
  stale-data run and fail on the next for reasons that have nothing to do with the change
  under test. Every time-dependent assertion in a live-data check is a scheduled failure
  waiting for the clock.

## Ten finalized payroll records were payable inside an unapproved period (2026-10-09)

- All 10 records in the draft *September 2026 payroll* period (₱500,000 net) sat `finalized`
  while the period itself was still `draft`, so the money was payable before anyone approved
  it. `scripts/fix-premature-finalization.mjs` returns exactly those rows to `draft`; it only
  touches periods that are not already approved, so real finalized-and-disbursed payroll is
  never reverted, and it deletes nothing.
- **This mattered beyond the failing gate step.** Migration
  `20261007130000_payroll_record_status_coherence.sql` installs a trigger that *rejects* a
  finalized record under an unapproved period. Those rows would have left the database
  permanently out of step with its own rule, so the constraint could not be trusted even
  after the migration lands. Gate step 11 now passes with 0 incoherent periods and ₱0 exposed
  before approval.

---

## The e2e suite was polluting the demo database, and the cleanup over-corrected (2026-10-09)

- **`mutations.spec.ts` created a leave request on every run** and never removed it, so repeated runs produced exact duplicates. That is what the live-data dedupe invariant was correctly reporting. It also selected the leave type with `selectOption({ index: 1 })`, which silently depended on seed ordering and landed on **BEREAVEMENT** — so each run filed bereavement leave into a tenant presented to prospects.
- **The first fix deleted too much, and this entry records that plainly.** Cleaning up with `.eq("reason", "E2E leave smoke")` looked equivalent to the cleanup itself but was not: every `leave_requests` row in the demo tenant carried that same reason, so the cleanup wiped the table to zero. Cleanup is now scoped by row ID — snapshot the IDs before submitting, delete only what did not exist before.
- **Root cause of the confusion, and a finding worth keeping:** no seed script ever *creates* `leave_requests`. `seed-demo-extended.mts` only dedupes them. All 8 rows were e2e residue. So `tests/live-data-smoke.test.ts` asserting `leave_requests >= 1` was never validating seeded demo data — it was passing on another test's side effect, and it cannot pass once that test cleans up after itself.
- **`scripts/seed-demo-leave.mjs` restores the demo history (17 rows, applied 2026-10-09).** `/app/my/leave` no longer renders *"No leave requests yet"*, and `/app/leave` has both a `pending` and a `manager_approved` request awaiting someone. Additive and idempotent: it exits early if any history exists, skips bereavement / leave-without-pay / maternity / parental, offsets dates per employee so no two rows share `(employee, start, end)`, and refuses to write if a `pending` request would start on or before today. **Unit tests are 449/449 and the ship gate is 15/18.**
- **The e2e test *"leave approve opens confirm"* still skips, and seeding does not fix it.** Correcting an earlier assumption in this entry: I expected repopulating the table to unblock it. It does not. `/app/leave` only renders approve controls when `mapPendingApprovalActability` reports `canAct`, and that comes from approval-workflow step assignment for the signed-in actor, not from how many rows exist. A `manager_approved` row was inserted deliberately to test that and HR still shows *"Waiting for …"*. So the skip is about workflow assignment, and the demo HR user is not currently an actor at that step. Left skipping with its reason intact rather than weakening the test to make it green.
- **The CI cleanup step went with it.** `.github/workflows/ci.yml` ran `cleanup-leave-duplicates.mjs --apply` with `if: always()` on the stated grounds that mutations left a duplicate per run. Once that was fixed at the source the step had no reason to exist, yet it would still have run every build, still dragged privileged Supabase credentials into the job, and still deleted live demo data on a schedule nobody reasoned about. Removed, and `tests/ci-and-account-honesty.test.ts` now asserts its **absence** — the old test pinned the workaround, which would have invited someone to reinstate it.

---

## Card titles were not headings, and a loading skeleton carried a prohibited ARIA attribute (2026-10-09)

- **`CardTitle` rendered a `<div>`,** so every card title in the app was invisible to heading navigation. axe never flagged it — a `<div>` is not a *broken* heading, it is simply not one — which is why this sat unnoticed through every previous sweep. It surfaced when a Playwright locator asked for a heading role and failed against a page that looked correct.
- The rest of the app already used real headings (`PageHeader` is the `<h1>`, with `<h2>`/`<h3>` beneath), so the card was the odd one out. `CardTitle` now renders `<h2>`: directly under the page `<h1>`, so it cannot introduce an axe heading-order skip. Tailwind's preflight already normalises heading size/weight/margin, and the element sets its own font and weight, so nothing moves visually.
- **A positive assertion replaces the accidental discovery.** `e2e/a11y.spec.ts` gained "card titles are exposed as headings", which asserts the heading role is present *and* that it is an `H2`. A scanner cannot catch the absence of a heading; only a positive check can, so the same regression cannot return quietly.
- **That change immediately failed two unrelated pages**, which is why it was worth making. `client home` and `client timesheets` hit `aria-prohibited-attr` (serious): *"aria-label attribute cannot be used on a div with no valid role attribute"* on `aria-busy="true" aria-label="Loading"` — the route-level loading skeletons in `app/app/crm/loading.tsx` and `app/app/tickets/loading.tsx`. `aria-label` is simply not permitted on a role-less `<div>`. Both now carry `role="status"`, which is the correct construct for a loading indicator and permits the label.
- **a11y is now 14/14**, up from 13.

---

## An a11y check was asserting a coarse-pointer rule under a fine-pointer browser (2026-10-09)

- **`e2e/a11y.spec.ts` "notification switches … meet the 44px touch target" could not pass.** The `Switch` primitive's 44px target is not the element box — it is an `::after` overlay that grows only under `@media(pointer:coarse)`. The test set `viewport: 390×844` and `hasTouch: true`, and the comment above it asserted that was enough. It is not: `hasTouch` enables touch *events* but leaves `pointer` fine, so `[@media(pointer:coarse)]:after:-inset-y-[15px]` never applied and the switches measured **24×30**.
- The numbers make the diagnosis exact. An `sm` switch is 24×14; the non-coarse overlay adds `±8px` vertically (→ 30) and `±12px` horizontally (→ 48). Under a coarse pointer the same switch adds `±15px` vertically (→ **44**, exactly the minimum) and `±12px` horizontally (→ 48). The test was measuring a configuration that never occurs on a real phone.
- **`isMobile: true` added alongside `hasTouch`** — that is what makes Chromium report a coarse primary pointer. The check now passes measuring 48×44.
- **Why it had been recorded green:** it was green when the preference switches were not yet on `/app/my/notifications`. Adding them exposed a check that had never actually exercised the rule it was named after. This is the same shape as the other six tools in this project that reported results they had not earned.

---

## The touch-target sweep was 5 changes, not 23 — and the classifier was wrong 18 times (2026-10-09)

- `scripts/audit/audit-touch-overrides.mjs` classified the 242 `min-h-11` call sites and reported **23 DEFEATS-COMPACT-VARIANT**. **18 of those were correct code.** It matched `min-h-11` as a substring, which also matches `[@media(pointer:coarse)]:min-h-11` — the *right* way to write the rule (36px desktop, 44px touch). Acting on that list would have deleted the exact pattern the project wanted, on 18 sites, and the responsive sweep would have caught it only after the fact.
- The matcher now requires a bare token — preceded by whitespace or a quote, where a variant-prefixed one is preceded by `]`. Real defects: **5**, and they are fixed — `app-header` (2 icon buttons, `min-h-11 min-w-11` on a `size="icon"` variant that is 32px by design), `notifications-page-client` (2), `recalculate-button`, `employee-auth-shell`.
- **The remaining 96 are reported by surface**, because "96 need a design decision" is not answerable: **82 app surfaces, 9 marketing, 5 auth**. The answer flips by surface — a 44px CTA on a public page is ordinary, a 44px button in a dense desktop table is not. The codebase already has the right idiom (18 call sites use `[@media(pointer:coarse)]:min-h-11`, as does every `Button` variant), so the app-surface rows contradict `DESIGN_SYSTEM.md` §3's own principle. Converting them is a whole-app desktop height change and is left as the user's call.
- **Verified the floor survived.** Removing an override is only safe if the primitive still provides it: `Button` carries `[@media(pointer:coarse)]:min-h-11` on every size variant and `[@media(pointer:coarse)]:size-11` on the icon variants. `/app/my/notifications`, `/app/payroll/periods` and `/app/dashboard` sweep **24/24** after the change — no touch failures.
- **That sweep then caught a pre-existing `TEXT<16` on `/app/my/notifications`** — a 12px notification timestamp, unrelated to these edits (`git diff` confirms only the two `className` lines changed there). The responsive auditor only flags text of 25+ characters, and this line is 34, so it had been slipping past. Fixed with the codebase's existing `text-base … sm:text-xs` pattern, in both `notifications-page-client` and `notification-bell`.

---

## The design gate said "no raw primitives" while checking two tags (2026-10-09)

- **`scripts/audit-design-system.mjs` flagged raw `<select>` and raw `<table>`. Nothing else.** Every hand-rolled `<input>`, `<textarea>` and `<button>` in the app was invisible to it, while the verdict line read `VERDICT: no raw primitives and no hardcoded colours` — a much broader claim than the rule behind it.
- Widening it to those three tags found **11 files**. Not 300. My first count said 305 and that number was wrong: PowerShell's `Get-Content` treats the `[slug]` in route folders as a wildcard and silently failed on ~15 files, and ripgrep's count mode counts *lines* not occurrences. Both were tools lying about the same question.
- **5 fixed.** Four raw buttons that were hand-rolled ghosts/outlines of what `Button` already provides — `app-header` account menu, `password-field` reveal toggle, `demo-login-picker` chips, `site-header` menu trigger. Plus one real break: the `type="date"` picker on `/app/attendance` carried `min-h-11 rounded-[12px] border border-line bg-mist/50 px-3 text-sm` **inside the same FilterBar as a correct `NativeSelect`** — two controls side by side that could not match. Now `<Input>`.
- **3 were correct code and the rule was wrong.** A `type="radio"` and two `type="checkbox"`s are a different control category; `Input` must not wrap them. The rule now exempts `hidden`/`checkbox`/`radio`/`file`/`range`/`color`/`image` **by type**, and still flags an untyped `<input>` because no `type` means text. Both directions are pinned by tests.
- **4 are deliberate**, allowlisted with written reasons and printed in CI output so the exemption list is visible rather than buried in source.
- 29 contract cases, up from 24.

## The payroll decision was three words long and missing every consequence (2026-10-09)

- **The reconciliation had been posed as "retire / shrink / retire"** with none of what each option actually costs attached. `pnpm audit:payroll-plan` (new, read-only) reads the live periods, records, components, payslips and cash-advance deductions, then prints for each option the exact SQL *and its blast radius*. It changes nothing.
- **"Retire the draft" is not "keep the good one."** `payroll_records.payroll_period_id` is `on delete cascade` and so is `payslips.payroll_record_id`, so deleting the draft period takes **10 payroll_records, 30 payroll_components and 10 payslips** with it — the payslips employees read in `/app/my/payroll`. And the surviving fortnight holds only **1** record, so afterwards 9 of 10 employees have no September pay at all and **nobody is paid for Sept 16–30**. A new period has to be created and run or September goes out short.
- **"Shrink to Sept 16" looks like a one-line fix and is not.** The 10 records still carry amounts computed across the **full month** (₱500,000). After the date edit those figures are stale, must be recalculated, and the 10 existing payslips become **wrong rather than missing**.
- **The shortcut that does not work:** voiding the duplicated *records* fixes the double payment but does not unblock `20261007120000_payroll_period_no_overlap.sql`. That EXCLUDE constraint is on `payroll_periods.daterange(...)` — it constrains **periods**, not records — so `ADD CONSTRAINT` still fails validation until the periods themselves stop overlapping.
- **The duplicate employee's two records disagree**: ₱24,500 in the fortnight, ₱26,760 in the monthly run. Not one computation stored twice — two runs that calculated different figures for the same days. So "just delete one" is not automatically safe.
- Good news from the same scan: `cash_advance_deductions` and `payroll_approvals` have **0** rows pointing at either period, so no cash-advance linkage is lost whichever option wins.

## A migration preflight that reported 80 confident falsehoods, and was cut down (2026-10-09)

- Four migrations are written and **unapplied** — blocked on credentials, so they have never been run. `supabase db push --dry-run` settles it properly but authenticates against the linked project, needing the credentials that are missing.
- **The first version tried to resolve `public.x` identifiers and produced 80 findings in a single run, every one wrong.** `on delete cascade` read as a missing object named `delete`; `public.numeric` as a schema object; `from generate_series(...) ea` as a table named `ea`. It also had the pending list inverted, reporting 30 long-applied migrations as pending.
- **It now does one thing: dollar-quote balance.** An unterminated `$$` swallows the rest of the file and produces a syntax error far from the real cause, which is cheap to detect statically and expensive to debug live. Identifier resolution needs a real SQL parser; a regex cannot tell a keyword from a schema object, and a gate that is confidently wrong gets switched off and then believed when it is accidentally right.
- The script **prints what it does not check** on every run: not grammar, not columns, not data, and a clean run is explicitly *not* a pass. 8 contract cases including the inverted-list and false-positive regressions.

---

## The admin role filter was deleted the moment you turned the page (2026-10-09)

- **`/app/admin/users` reads `stringParam(params.role)` and renders a `FilterSelect` for it, but passed only `query={{ q }}` to its `ListPager`.** `ListPager` rebuilds its href from that object alone — `hrefFor()` starts from an empty `URLSearchParams` — so `/app/admin/users?role=owner` plus a click on Next produced `?page=2`: no role, no text, everyone. No error and no empty state, just a list that confidently answers a question nobody asked, on the screen whose whole job is answering questions about who holds which role.
- The role list is read from the **`roles` table**, not from `admin-invite-form.tsx`'s `ROLE_OPTIONS`. That list is deliberately a subset — it omits Owner and Super Admin because you cannot invite yourself as one — so reusing it would have made "who is an Owner?" unanswerable, which is one of the reasons the filter exists.
- **The role id list was unbounded.** Resolving a role means reading `membership_roles` for its id and inlining those membership ids into a `.in()` filter — into a URL. The text-search sub-queries beside it cap at 100 and 50; this one had no cap. Now capped at 1000, with the tradeoff written down at the call site: an undercount beats a 414 and a blank page.
- Also de-shadowed `roleRows`, which named the page-level role catalogue *and* the per-membership role list in the same file.

## The filter-persistence gate accused 15 pages; 15 were the gate (2026-10-09)

- **`scripts/audit-filter-persistence.mjs`** sweeps every page rendering a `ListPager` and fails if it reads a filter that the pager does not carry — the defect above, swept across all 32 paginated pages. Gating step in `verify-all`, aliased `pnpm audit:filters`.
- **It took three drafts to become trustworthy, and the first two were wrong in instructive ways.** Version 1 extracted only `key: value` entries, so the shorthand `{ q, status }` — used by most pages — yielded nothing and it reported 14 violations that did not exist. Version 2 read only inline `query={{ … }}`, missed `/app/attendance`'s `query={filterQuery}`, and called that page's four filters dropped. Version 3's identifier regex required `}` immediately after the name, so `query={buildIt(q)}` matched *nothing at all* — no note, and the page was charged with dropping `q`.
- **The rule that actually matters is the third one:** a query expression the scanner cannot resolve makes the page **unverified, not accused**. A scanner that cannot read a file has no standing to convict it. Earlier drafts reported a parse failure as a defect in the code, which is how a gate becomes the thing people learn to ignore.
- **13 cases in `tests/filter-persistence.test.ts`**, including negative controls for all three false positives above, one that proves the identifier path is not merely permissive, a comment-stripping control, and a bad-path control that asserts exit 2 rather than any verdict.
- Live: **32 pages scanned, 0 dropped, 0 unverified.**
- **The four pre-existing filter tests only assert the URL changed**, which is precisely the check the bug above would have passed. Added two to `e2e/filters.spec.ts` that assert the *rows* narrow: one picks a role off the control and checks every rendered Roles cell matches it and that the result differs from the unfiltered set, one checks the role filter composes with the text search. **7/7 green** against a production build.
- My first draft of those two tests asked for `getByRole("heading", { name: /invite internal user/i })` and failed against a correct page — `CardTitle` renders a `<div>`, as shadcn's does, so there is no heading landmark to match. Worth recording separately: **card titles across the app carry no heading role**, so they are invisible to heading-navigation. Changing `CardTitle` to a real heading would alter the document outline app-wide and is its own piece of work, not something to slip in here.

---

## The E2E CI job was a switch that flipped to "everything fails" (2026-10-08)

- **`.github/workflows/ci.yml` had an `e2e` job gated on `vars.RUN_E2E == 'true'` — and nothing else.** No build, no server, no cleanup. Turning it on would have pointed Playwright at port 3000 with nothing listening, and the documented instruction "enable with repo variable RUN_E2E=true" would have produced a wall of connection-refused failures that looked like a broken app.
- `playwright.config.ts` does define a `webServer` fallback — but only when `PLAYWRIGHT_BASE_URL` is unset, and it starts **`pnpm dev`**. Four sequential projects would each pay a dev compile, and the service worker plus demo-login gating behave differently in a dev server than in what ships.
- The job now builds once, starts `pnpm start` with a `/login` health-check loop, and sets `PLAYWRIGHT_BASE_URL` on all four Playwright steps so `webServer` stays out of the way. It also dumps the server log on failure — a job that dies at startup should say why.
- **`scripts/cleanup-leave-duplicates.mjs --apply` is now an `if: always()` step.** `mutations.spec.ts` submits a real bereavement leave request, so every E2E run leaves a duplicate that makes `live-data-smoke` fail on the *next* run. `always()` because a failing suite is exactly when the data is most likely to be dirty.
- **That cleanup script could not have run in CI at all** — it threw on a missing `.env.local`, which CI does not have. It now reads `process.env` as a fallback and names the missing variables instead of failing on a file.
- **Four structural invariants are pinned in `tests/ci-and-account-honesty.test.ts`**, verified by a negative control that deletes `pnpm start` and watches the test fail. The parser reads *steps* rather than searching the file as one string, because a flat search cannot tell you whether `PLAYWRIGHT_BASE_URL` is on the step that actually runs Playwright — and its first version had exactly that bug, counting a doc comment that mentioned "playwright test" as a fifth test step.

---

## A marketing manager with 60 FAQs could never see FAQ 51 (2026-10-08)

- **`/app/cms` capped all six of its lists at 50 with no pager** — blog posts, services, FAQs, industries, testimonials, case studies. It was the last place in the app where real editorial work could simply vanish.
- **The page is not tabbed.** All six lists are stacked on one page, which is why a single shared `page` param would have been wrong: advancing to the testimonials pager would have landed on testimonials page 3 because you had paginated FAQs — six independent queues fighting over one URL parameter.
- **`ListPager` gained an optional `param` prop** for the query key, defaulting to `page` so all 27 existing call sites are unchanged. `/app/cms` passes `faqsPage`, `postsPage`, `servicesPage`, `industriesPage`, `testimonialsPage` and `casesPage`.
- **Verified the page the right way round.** `/app/cms` had been removed from the *owner* responsive sweep earlier, because owner has no `cms.manage` and the sweep was reporting a guaranteed `DENIED forbidden`. Running it as `marketing@demo.beepabpo.com` gives **8/8 clean across every viewport** — which both validates the change and confirms the earlier removal was correct rather than a way of hiding a broken page.
- The pager's `Page {n}` label was `text-sm`, inherited from the old world before the `Card` fix; it is now `text-base sm:text-sm` like the rest.
- **The a11y gate now covers all three pages that changed.** `e2e/a11y.spec.ts` went from 10 to 13 checks, adding `/app/approvals`, `/app/client/timesheets` and `/app/cms`. A pager is a `<nav aria-label="Pagination">` — a new landmark on every one of those pages, which is exactly the thing that should be re-run against axe rather than assumed safe. 13/13 green.
- **I removed a test I had just written because it could not pass.** It asserted a Pagination nav was visible on `/app/cms` — but with 7 seeded FAQs the pager returns `null` and never renders. The replacement states the limit plainly: these checks prove the *pages* still pass axe, not that a rendered pager does. Manufacturing >50 rows to satisfy a test would pollute the demo data, and the pager markup is shared with the 27 list pages that do render it.

---

## Two queues where the work you couldn't see was real (2026-10-08)

- **`/app/approvals` capped pending approvals at 50 with no pager.** This is the cross-domain action queue — leave, cash advance, attendance correction, payroll, all in one list. A pending item at position 51 was not merely hard to find, it was **invisible**, with nothing on the page to suggest more existed. It is the one screen whose entire purpose is telling someone what is waiting for them.
- **`/app/client/timesheets` capped pending client reviews at 40, also with no pager** — days 41+ waited with no indication they were there.
- Both now use `.range()` + `ListPager`, matching the 24 pages that already did it.
- **The timesheets heading counted only what fit on the page.** "Awaiting your review (n)" derived `n` from the returned rows, so under pagination it would have reported "20" while 47 days waited. It is now backed by a real `count: "exact"` query, with a test asserting the heading does not fall back to the page length.
- **I had to correct my own documentation.** The previous list of "pages that still cap silently" named eleven `.limit()` sites without distinguishing a rendered list from an aggregate sample or a search-candidate sub-query. Most were not defects: `/app/client/reports` caps 2000 rows feeding a rollup, and `/app/app/admin/users` caps 100 *candidate ids to search*, not the rendered list. The doc is re-split into fixed / legitimate / genuinely-open in `docs/REMAINING_WORK.md` §2.3. **A blanket "no `.limit()`" gate would flag all of that correct code** — and a gate that flags correct code gets switched off.
- **Two of my own assertions failed before the code did.** The pagination test first rejected `/app/admin/users` for a `.limit(50)` that was a search-candidate query, and then rejected `/app/client/timesheets` because my own explanatory comment contains the literal text `.limit(40)`. Both are the same mistake `scripts/audit-design-system.mjs` was built to avoid — reading comments as code — so the test strips comments before asserting, exactly as the auditor does.

---

## The `Card` was silently setting 14px on everything inside it (2026-10-08)

- **`components/ui/card.tsx` carried a bare `text-sm` on the `Card` wrapper**, so every descendant that did not declare its own size inherited 14px — including plain `<p>` elements that read as body copy. `CardTitle` already compensated with `text-base`, which is why cards *looked* correct while their paragraphs violated the 16px-mobile rule.
- **It survived a full 232-combination responsive sweep** because the auditor only flags text of **25 characters or more**. "CloudPeak" and "Acme Corp" never crossed the threshold, so entire categories of card carried the same inheritance invisibly. Only a 28-character job title surfaced it.
- **Fixed in the component, not at the call site:** `text-sm` → `text-base sm:text-sm` — 16px on a phone, 14px on a desktop. This changes desktop density not at all, so it needed no visual re-review, and it fixes the defect everywhere rather than on one page. It follows the same philosophy `Input` and `Button` already use for the 44px coarse-pointer floor: the accessible size is the default, density is opt-in.
- **The call-site override was then removed** so the sweep would prove the systemic fix carries it, rather than proving the override. `/app/recruitment/jobs` still passes with no size class on the paragraph at all.
- **Three regression tests added**, including a negative control that rejects a bare `text-sm` *even when* `sm:text-sm` is also present — `text-sm sm:text-sm` still renders 14px on a phone, so the responsive variant's presence alone proves nothing. Verified by reverting `Card` to the old value and watching exactly those two assertions fail.

---

## Prose below 16px on phones, and a sweep that was asking a question with no answer (2026-10-08)

- **The full 232-combination responsive sweep found 17 failing route × viewport combinations** — and they fell into exactly two kinds. Nine were genuine, eight were not.
- **The real nine:** `/app/clients`, `/app/recruitment/jobs` and `/app/admin` each rendered prose at 12–14px on phones, because `body { font-size: 16px }` does not help when a child applies `text-xs`/`text-sm`. `components/app/clients/client-invite-form.tsx` and `app/app/recruitment/jobs/page.tsx` now use the `text-base … sm:text-sm` pattern that `components/app/admin/admin-invite-form.tsx` had been using all along — so the fix was making stragglers match the convention, not inventing one. The rule is now written down in `docs/DESIGN_SYSTEM.md` §3 rather than living in someone's memory.
- **The other eight were the auditor's route list being wrong.** `/app/cms` was in the *owner* default route list, but `cms.manage` is granted only to `marketing` — the owner role has no CMS permission at all. So the sweep asked a question whose only possible answer was "denied", and reported `DENIED forbidden` at all 8 viewports. The page was never broken; the test was. It has been removed from the owner list with the reason recorded inline and the correct command for covering it with the right account.
- **This is the same class of error as the 403-scored-as-PASS bug**, from the opposite direction: a fixed route list is a claim about who can see what, and that claim was never checked against the role's actual permissions.
- **The coarse-pointer floor was verified, not assumed.** `hasTouch: true` + `isMobile: true` make Chromium report `pointer: coarse`, so the sweep genuinely exercised `[@media(pointer:coarse)]:h-11` and measured the migrated dropdowns. **0 smallTargets across all 224 combinations** — every control on every audited page clears 44px on a phone.
- **Re-run result: 224/224 clean.** The last element was `font-medium text-navy` on the job title, rendering at **14px** — not because the element declared it, but because `components/ui/card.tsx` sets `text-sm` on the **whole subtree**. `CardTitle` compensates with `text-base`; a plain `<p>` does not. It only surfaced because "Customer Support Specialist" crosses the auditor's 25-character threshold, while "CloudPeak" never did — so the same inheritance had been hiding in plain sight on other pages. Fixed at the call site; the systemic `Card` question is written up in `docs/REMAINING_WORK.md` §2.0 because removing `text-sm` from `Card` is a desktop-wide visual change that needs a full re-sweep.
- **A wrong diagnosis is worse than no diagnosis, because it gets written into the docs as a reason not to retry.** Three backoff attempts (0 s, 150 s, 300 s) had failed with `page.waitForURL: Timeout 30000ms exceeded`, and I recorded it as "the Supabase auth rate limit rejected it" — a plausible story, because rate-limiting *is* a real failure mode here. It was wrong. The script read the email from `process.argv[2]` unconditionally, so `node audit-app-responsive.mjs /app/recruitment/jobs` logged in with the literal string `"/app/recruitment/jobs"` as the username and then swept the entire default route list. Hours later, with no rate limit anywhere near recovery, the identical call failed the identical way — which is what finally disproved the theory. The script now detects an email by shape rather than by position, and both invocation forms are verified.

---

## One design system, and a gate that proves it (2026-10-08)

- **26 dropdowns across 22 files had each drifted to a different radius and background — and not one of them had a focus ring.** They were raw `<select>` elements, not the shadcn primitive, so keyboard users could not see where they were in a form full of dropdowns. Every other control in the app had a ring; the dropdowns were the exception and nobody noticed because they all looked plausible.
- **`components/ui/native-select.tsx`** is now the only way to render a `<select>`: `NativeSelect`, `NativeSelectCompact`, and `nativeSelectClassName` for callers that need the styling without the wrapper. It mirrors `components/ui/input.tsx` deliberately — same radius, same border, same focus treatment, same `text-base md:text-sm`, same disabled and `aria-invalid` treatment, same coarse-pointer floor.
- **The element stays native on purpose.** Every dropdown is registered with react-hook-form, which needs native form semantics and a real form value, and this is a BPO app used mostly on phones where `<select>` opens the platform picker — the wheel on iOS, the sheet on Android. A custom listbox is visually identical on desktop and materially worse on the device most of the workforce actually uses. `components/ui/select.tsx` therefore stays unused, and a test asserts nothing imports it so nobody "fixes" this later.
- **`[@media(pointer:coarse)]:h-11` was missing from the primitive while its own doc comment claimed it mirrored Input's coarse-pointer height** — 32px dropdowns next to 44px inputs on phones. The contract test exists partly to stop a comment like that from being believed.
- **`FilterSelect` was the highest-leverage fix:** it feeds 18 list pages, so migrating it alone standardised every hot queue's filters in one change.
- **The last raw `<table>` is gone** (`attendance-heatmap.tsx` → Table primitives), and it now derives both its class and its swatch from a single `KIND` map, so a status kind can no longer have a class but no colour.
- **The attendance 4-colour palette existed in three places** — team-status donut, client dashboard, heatmap — as three unrelated copies. `lib/attendance/status-colors.ts` is now the single definition, and `components/app/attendance/attendance-heatmap.tsx` consumes it.
- **New semantic status layer in `app/globals.css`**: `positive` / `caution` / `critical` / `info`, each a *pair* of a saturated foreground and a tinted surface, so a new status cannot be added without choosing both. Plus a separate 5-step categorical ramp for charts (navy/green/lime are not four usable series colours) and `--color-data-empty` so "no data" never reads as a real category. `caution` is a brown-gold, not amber — amber is not in the brand palette and lime fails contrast as text.
- **Sidebar colours moved out of arbitrary Tailwind properties in `app-sidebar.tsx` into `--sidebar*` tokens.** They were a second copy of the brand palette at a call site; a palette change would have had to be made twice with nothing to say the second was missed.
- **`scripts/audit-design-system.mjs`** fails on a raw primitive outside `components/ui/` or a colour literal outside the token layer; arbitrary radii are reported but do not fail, because a 130-site sweep cannot be reviewed for visual regression in one pass. Two files are allowlisted with printed reasons: `app/manifest.ts` and `app/layout.tsx`, which emit serialized output that never touches the stylesheet. It is wired into `verify-all.mjs` as a gating step, so it cannot be forgotten.
- **It also had a path bug, found by running it rather than reading it** — `relative()` returns backslashes on Windows, so `startsWith("components/ui/")` matched nothing and the script audited its own primitives. Sixth tool this session that reported something it had not earned.
- **The primitive was it missing from the audit.** After the first clean run, `NativeSelect`'s own comment asserting coarse-pointer parity was contradicted by the class string. Fixed, and `tests/design-system-contract.test.ts` (24 cases) now pins the mirror contract.
- **8 of those 21 cases exist only to prove the auditor can fail** — it is run against throwaway fixtures that each violate exactly one rule and asserted to fail: raw select, raw table, hex literal, `rgba()` literal, comment-only mentions, the `components/ui/` exemption, the serialized-output allowlist, and that arbitrary radii do *not* fail. An auditor that cannot fail is worse than no auditor, because it gets trusted.
- **Result: 0 raw primitives, 0 hardcoded colours, exit 0.**

## Every page a role can see, actually works — 219/219 across all 13 roles (2026-10-08)

- **New `scripts/audit-role-pages.mjs`** answers the question a user actually has: is every page this role can *see* actually reachable and working? It reads the **rendered sidebar** rather than a fixed route list, so it never tests a route the role cannot see, and it always catches a link the nav offers but the page refuses.
- That is the gap the existing audits could not cover. Static RBAC auditing confirms each page *declares* a permission check; it does not confirm the nav agrees with the page. A role shown a link and then 403'd by the page is the worst outcome an RBAC system can produce — an affordance that actively promises something it cannot deliver.
- **219/219 nav-reachable pages clean** across owner 36, superadmin 23, hr 18, sales 19, marketing 18, operations 17, teamlead 17, finance 17, recruiter 14, employee 12, clientadmin 12, clientviewer 12, applicant 4.
- **Three false-positive classes found by running it rather than reading it.** `/app` is a dispatcher that forwards internal users to `/app/my` and client users to `/app/client` — counting that redirect as a failure reports the router working. Pre-filtered nav links like `/app/crm/leads?status=new` carry a query string that `URL.pathname` drops, which cost sales a clean run until compared as `pathname + search`. And Supabase rate-limits repeated auth from one IP, so logging in 13 times back-to-back intermittently fails a healthy role; that surfaces as an explicit `LOGIN-FAIL` rather than being silently counted clean.
- The `hr` row is 18 pages **without** `/app/recruitment`, which is precisely the gap the unapplied `20261008120000` migration closes.

## Careers were impossible for HR, and an applicant could only apply by leaving the app (2026-10-08)

- **The `hr` role had no `recruitment.*` permission at all.** It held `employees.*`, `attendance.*`, `leave.*`, `nte.*`, `cash_advance.*` and `performance.*`, so the Recruitment nav item was filtered out and `/app/recruitment` returned **403**. In a BPO, HR owns the pipeline: the people who onboard a hire could not post a vacancy or advance a candidate, so hires had to be created by hand in `/app/employees` with no link back to the application.
- **Migration `20261008120000_hr_recruitment_access.sql`** grants `recruitment.read` + `recruitment.manage` to `hr`. Manage (not just read) is required because stage changes and the hire conversion are gated on it; `convertApplicantToEmployee` also needs `employees.manage`, which `hr` already had, so the pair completes without a second grant.
- **The applicant role still has no `recruitment.read`** — `20260911150000` removed it deliberately, because that permission would expose the entire applicant table. Applicants reach roles through the `status = 'published'` RLS policy instead, which grants nothing about other candidates. The new tests assert this stays revoked.
- **Applicants could see their applications but not the jobs.** Applying meant leaving the portal for the public `/careers` page; the empty state on their own dashboard instructed them to do exactly that. Added `/app/applicant/jobs` (published roles, with an "Applied" marker computed from their own applications) and `/app/applicant/jobs/[id]` (role detail + apply, reusing the same `JobApplyForm` the public page uses, so validation and the duplicate-application guard are identical). Draft and closed roles 404 rather than render.
- **`/app/applicant/notifications` existed but was not linked from anywhere in the applicant nav** — reachable only by typing the URL. It is now in both the desktop and mobile nav, alongside Open roles.
- The applicant dashboard now explains what each stage means and where they are in the pipeline, instead of `stage.replace(/_/g, " ")` in a grey badge.

## Twelve application stages now carry real meaning (2026-10-08)

- **Every stage rendered as `stage.replace(/_/g, " ")`** — "Client endorsement" tells an applicant nothing about whether they are still in the running, and tells an HR reviewer nothing about the difference between a deliberate `on_hold` and a stalled `screening`.
- **`lib/recruitment/application-stage.ts`** gives all twelve a label, a tone, an applicant-facing note, a staff note, a terminal flag and a pipeline position. `StageBadge` and `StageExplainer` render them; the stage form offers them in Pipeline / Finished / Parked optgroups and the confirm dialog states what the *target* stage means before you commit.
- **`on_hold` and `talent_pool` are explicitly non-terminal.** Treating them as finished would tell an applicant their application is dead when it is not.
- **The enum values are parsed out of the migration in the tests, not re-typed**, so adding a stage to the database without adding it here fails the build rather than silently rendering as an unstyled string. `stageMeta` also falls back safely on an unmapped value instead of throwing inside a server component.
- Badge colours use existing design tokens only (navy / green / lime / mist). `neutral` and `warning` were briefly near-identical; lime separates them without introducing an off-palette amber.

## The responsive auditor scored a 403 as a perfect page (2026-10-08)

- **`audit-app-responsive.mjs` reported `PASS` for `/app/recruitment` under an `hr` account** — the page HR cannot open. It detected access denial only by watching for a URL change, and Next's `forbidden()` renders **at the requested URL** rather than redirecting. A 403 page is laid out cleanly, so it produced zero overflow flags, zero touch-target flags, zero console errors: a flawless score for a page that shows nothing but "Access not allowed".
- This is the same mechanism the E2E client-isolation tests discovered earlier in the project; the auditor never learned it. A fourth tool this session that reported something it had not earned.
- **Fixed structurally, not by text-sniffing.** `forbidden.tsx` and `error.tsx` now carry `data-page-status`, and the auditor reads that attribute and records `DENIED forbidden` as a failure.
- **Verified by negative control:** `/app/hr` still passes, `/app/recruitment` now fails with `DENIED forbidden`, and the script exits 1.
- The boundary markers are also asserted by `tests/recruitment-careers-access.test.ts`, so removing them cannot silently re-open the hole.

## `PageHeader` rendered a greeting as the page H1 (2026-10-08)

- **The new job detail page's H1 read "Good afternoon, Customer Support Specialist."** `PageHeader` always renders `Good afternoon, {first name}.` — it is a greeting header, and there was no way to give a detail page a subject as its title.
- Added an optional `title` prop that renders as the H1 instead of the greeting. Backward compatible; every existing caller passes `name` and is unaffected.
- Worth knowing for future detail pages: an H1 has to identify the page for a screen-reader user arriving by search or link, and a greeting does not.

## The payroll corruption had a second source, and the invariant is now in the schema (2026-10-07)

- **Traced the ₱500,000 unapproved-payroll finding to its actual cause.** Not the product: `lib/payroll/actions.ts` was already correct, advancing the **period** to `finalized` before cascading `finalized` to its records. Two *seed scripts* wrote record status directly with `service_role`, entirely outside the approval workflow — `scripts/audit/batch4b-finish.mjs` and `scripts/seed-demo-extended.mts`. Both are now fixed.
- **A regression scanner found the second one, not me.** The test that forbids "finalizing a record without finalizing its period first" immediately flagged `seed-demo-extended.mts` while I was fixing `batch4b-finish.mjs`. That is the case for writing the scanner before trusting you have found everything.
- **The scanner discriminates rather than blanket-banning a string.** `scripts/seed-demo.mts` also finalizes a record and is *correct* — it finalizes the period first. A naive ban would have flagged it, so it is kept in the suite as a legitimate control alongside four negative controls (original defect, period missing, inverted order, correct order).
- **Both seeds now derive record status from the parent period** instead of choosing it, and abort or warn loudly on orphan records and overlapping periods. They also stamped `engine: "stub_v1"` — a label retired by `20260922120000_payroll_frequency_fixed_salary.sql` in favour of `fixed_salary_v1`, which is the engine that actually produced those numbers. Both corrected.
- **One definition of "payable" now lives in `lib/payroll/status-coherence.ts`.** The payslip route, the payroll list, the seed scripts, the coherence audit and the new database trigger all import or mirror it. Previously each surface carried its own copy of the status lists, and one had already drifted into publishing money early.
- **New migration `20261007130000_payroll_record_status_coherence.sql`** adds a `BEFORE INSERT OR UPDATE` trigger rejecting a `finalized`/`paid` record whose period is not approved. It fires on plain `UPDATE`, not only on updates naming `status`, so an incoherent payable amount cannot be edited in place either. It is `SECURITY DEFINER` with a pinned `search_path` — without that, the RLS-filtered parent lookup returns nothing for an ordinary session and reports a false "missing period" instead of the real rejection.
- **Applying it is safe before the data is reconciled.** The trigger only governs future writes, and it explicitly permits the remediation (`finalized` → `draft` is not a payout-grade status). A final `RAISE NOTICE` reports any pre-existing violations instead of failing, which would otherwise block the reconciliation itself.
- **`20261007120000_payroll_period_no_overlap.sql`** adds the schema backstop for overlapping periods: an `EXCLUDE USING gist` constraint so they cannot be created at all.
- **22 new test cases**, including an enumeration of the exact incoherent combinations across both full enums (pinned to a known answer rather than "it did not crash"), a non-vacuity control, a cross-language check that both `.mjs`/`.mts` copies of the approved-period list still match the TS constant, a check that the approval workflow still finalizes the period *before* cascading, and a check that the trigger is `SECURITY DEFINER` with a pinned `search_path` and a revoked `EXECUTE` grant.
- `tests/payslip-approval-gating.test.ts` was rewritten: it previously asserted on private status constants, and now asserts both surfaces import the shared rule.
- **Still blocked, not fixed.** The two live periods still overlap and the 10 records are still premature. That is a business decision — see `docs/SYSTEM_AUDIT.md` §17.1.

## The release gate counted every skip as a failure (2026-10-07)

- **`verify-all.mjs` reported `13/16 steps passed`, `1 skipped`, and `3 step(s) failed` — which sums to 17 out of 16.** Failures were derived as `totalSteps - passedSteps`, so a skipped step was counted as neither passed nor skipped *and* still landed in the failure count. The run had **2** real failures.
- The verdict happened to be right, but only by luck: the failure count was doing double duty as "everything that was not a pass". Fixing the gate to refuse to print "Ship it" over a broken payroll while leaving it unable to count its own results correctly would have been half a fix.
- **Failures are now tracked explicitly** in `failedStepList`, and the summary **names** the failing steps instead of only counting them — "Payroll periods do not overlap", "Payroll period/record status coherent" is actionable in a way that "3 step(s) failed" is not.
- **The counts are asserted, not assumed.** `passed + failed + skipped === total` is checked before any verdict is printed; a mismatch exits 2 with `INTERNAL COUNT ERROR` rather than shipping a summary that does not add up.
- Correct output is now `13/16 steps passed`, `2 step(s) failed, 1 skipped. Do not ship.` (exit 1).
- **`tests/release-gate-honesty.test.ts` (10 cases)** pins all of this: failures tracked rather than derived, the counters reconciling, "Ship it" gated on zero failures *and* zero skips, a skip never incrementing the pass counter, and all three payroll data audits confirmed to `throw`. Includes a negative control built from a hypothetical soft audit, and asserts the gate's own exit codes.
- This is the third tool in two sessions that reported something it had not earned. The pattern is consistent enough to state as a rule: **a gate that cannot fail is decoration, and a gate that cannot count is worse — it is trusted anyway.**

## `nav-active` failed as a load detector under the release gate (2026-10-07)

- **`tests/nav-active.test.ts` timed out at 5s inside `verify-all.mjs`**, where `next build` runs 15 workers alongside the suite. It was not a scaling regression: the scaling assertion itself had already been made machine-independent, but the test still performed 2000 iterations over a 4001-item array, and that absolute cost does not survive contention.
- Reduced to 500 iterations per sample — still far enough above timer resolution for the ratio to be meaningful — with an explicit 30s test timeout.
- **Verified under load:** 5/5 passing in 2.03s with four additional vitest processes running concurrently. The lesson is that removing a wall-clock *assertion* is not enough if the *work* the test performs is itself load-sensitive.

## Notification switches had no accessible name (2026-10-07)

- **`aria-toggle-field-name` (serious, WCAG 4.1.2) on every notification page.** The preference labels were plain `<span>` elements, so a screen reader announced three unlabelled toggles. Found by extending `e2e/a11y.spec.ts` to the notification pages, which axe had never been pointed at.
- The visible text is now a real `<label htmlFor>` and each `Switch` carries a matching `aria-label`, so the association holds regardless of how base-ui wires its hidden input. One usage site, shared by the employee, client and applicant notification pages.
- **A11y coverage extended from 6 to 10 checks:** both notification pages, plus switch keyboard operability (labelled, focusable, `aria-checked` present) and the 44px touch target on a context with `hasTouch: true`.
- **The touch test was verified to catch the regression:** removing the coarse-pointer `::after` growth makes it fail; restoring it makes it pass. That check needs `hasTouch`, not just a narrow viewport, because `pointer: coarse` does not match otherwise — the first version of the test passed for the wrong reason.
- Also worth noting: the first version of the keyboard test used `locator.count()`, which does not auto-wait, so it reported zero switches on a hydrated page. Corrected to wait for visibility and an exact count.

## Performance audit reported 7/7 green over a total measurement outage (2026-10-07)

- **`audit-performance.mjs` printed `navigation failed` for every route and still reported `7/7 routes within budget`.** Failed navigations were skipped when counting, so a run in which *nothing loaded* scored as a perfect result. Unmeasured routes are now counted separately, printed in red, and force a non-zero exit.
- **It also silently ignored `BASE_URL`.** `const BASE = process.argv[2] ?? "http://localhost:3000"` meant that setting `BASE_URL=http://localhost:3100` pointed the entire run at port 3000, where nothing was listening — which is exactly how the outage above was produced. It now honours `BASE_URL` first, matching the other audit scripts, and keeps the positional form.
- **Re-measured properly** against the production build, authenticated as the demo employee: **7/7 measured, 0 over budget, CLS 0.000 on every route.** Worst LCP is `/app/my` at 984ms (TTFB 559ms, 597kB, 506 nodes); `/` is 368ms with 996 nodes and 440kB. The responsive typography and 44px switch work introduced no layout shift.

## The release gate was printing "Ship it" while payroll was broken (2026-10-07)

- **First end-to-end run of `verify-all.mjs` reported `16/16 steps passed` and `All checks passed. Ship it.`** — in the same output it had just reported a double-payment and ₱500,000 of unapproved payroll. The gate had never been run since these audits were added, so nobody had seen the contradiction.
- **The payroll steps only warned.** Both audits `console.log` a finding and return normally, so they counted as passes. The reasoning ("the fix is a business decision, so don't fail the build") was wrong: the gate's job is to block shipping, not to resolve business questions. An employee being paid twice for the same hours must never produce a green gate. Both now `throw`.
- **A skipped step was being counted as a pass.** Realtime is broken (migration unapplied), printed `skipped`, and still returned normally, so it incremented the pass count. Skipped steps are now collected separately and reported as `not verified`.
- **The summary printed "Ship it" whenever nothing threw**, ignoring skips entirely. It now requires zero failures **and** zero skips, and says which case occurred.
- **Result:** `13/16 steps passed, 3 failed, 1 skipped - not verified. Do not ship.` exit 1. That is the correct verdict for the current database.

## Date-only columns were parsed as UTC (2026-10-07)

- Postgres `date` columns arrive as `"YYYY-MM-DD"`. `new Date("2026-09-15")` parses that as **UTC midnight**, which is only correct when the local zone is UTC or east of it — at UTC-4 (the app also carries an `America/New_York` holiday calendar) it renders the previous day.
- Six render sites switched to date-fns `parseISO`, which reads a date-only string as **local** midnight: `work_date` on `/app/my/attendance` and `/app/employees/[id]`, and `start_date` / `end_date` / `pay_date` on `/app/payroll/periods/[id]`, plus `hire_date`.
- **Four tests** assert `new Date()` really does disagree across `UTC`, `Asia/Manila`, `America/New_York` and `Pacific/Auckland` (so the guard cannot pass vacuously), that local-midnight parsing agrees in all four, and that no date-only column is passed to `new Date()`.

## E2E demo-login spec failed against any production build (2026-10-07)

- **Three `demo-login.spec.ts` tests failed for the wrong reason.** `getDemoLoginConfig` returns `null` when `NODE_ENV=production` unless `ALLOW_DEMO_LOGIN=true`, so the demo picker is never rendered in a production build. The spec assumed the picker was always present and reported `expected '' to be clientadmin@demo.beepabpo.com` — the app was behaving correctly and the test was wrong.
- **The spec now skips with the reason** instead of failing, so the suite is honest about what it did and did not exercise.
- **Verified both directions, so coverage is not silently disabled:** 3 skipped with demo login off, and **4/4 passing** after rebuilding with `ALLOW_DEMO_LOGIN=true`.
- **Full E2E re-run after this session's changes: no regressions.** Employee `chromium` 13/13, `owner` 7/7, `client` 13/13, `anonymous` 62 (58 passed / 3 skipped / 1 setup). Run against a production build, projects sequential.

## All-role responsive coverage (2026-10-07)

- **Every demo role is now swept at 390 and 768 — 100/100 combinations clean.** Previously only owner had been swept; employee was added earlier in the session. Owner 14/14, finance 14/14, team lead 14/14, employee 14/14, client admin 20/20, client viewer 18/18, applicant 6/6.
- **Notification preference switches failed the 44px touch minimum.** The shared `Switch` paints 18.4px tall; its tappable area is the `after:` overlay, which was only 34.4px. The overlay now grows on coarse pointers to clear 44px in both dimensions.
- **The responsive probe measured the wrong box for such controls.** It read `getBoundingClientRect()` of the painted element, ignoring the `after:` overlay that actually receives taps — so it reported a false failure for the Switch while the real hit area was larger. It now widens the rect by the pseudo-element's computed negative insets, the same reasoning it already applied to form controls wrapped in a `<label>`.
- **Base-ui's hidden native inputs were counted as tap targets.** Each Switch renders a 1x1px `<input type="checkbox">` inside the focusable root. Probed before exempting rather than assumed: all carry `aria-hidden="true"` and `tabindex="-1"`, so they are form-value proxies, not user targets. Now explicitly skipped.
- **The probe flagged elements that were not rendered at all.** The small-text check tested `display` on the element itself, but an ancestor with `display:none` leaves the element's own computed display intact. The app header's role label sits in `hidden md:block` — absent below 768px — yet was reported on every page at mobile widths. It only appeared to pass for the employee role because that role's label string fell under the probe's 25-character filter, so the same element was judged inconsistently by role. Now skipped via a zero-size bounding rect, which is the reliable signal that nothing was painted.
- **Body copy on 12 further pages raised to the 16px mobile floor** via `text-base sm:text-sm` / `text-base sm:text-xs`: client hub, tickets, requests, billing, settings, payroll periods list and detail, payroll run wizard, reports, approvals metadata, applicant applications, admin invite form. Desktop density is unchanged.

## Unapproved payroll was downloadable by employees (2026-10-07)

- **Employees could download payslips from an unapproved payroll run.** `payroll_records.status` and `payroll_periods.status` are independent columns with nothing in the schema tying them together. Both `/app/my/payroll` and `GET /app/my/payroll/<id>/payslip` gated on *record* status alone, so a period still in `draft` exposed payslips to staff.
- **Live data proved it.** The draft period `September 2026 payroll` held ten finalized records totalling **₱500,000** in net pay. `GET` on the demo employee's record from that period returned **HTTP 200 `application/pdf`** — a real payslip for pay nobody had approved.
- **Both surfaces now require the period too.** The PDF route refuses with `403` and names the blocking state; the list page inner-joins `payroll_periods` and filters on `finalized/disbursed/closed`. The change is strictly narrowing: the approval flow finalises the period and its records together, so an approved run serves payslips unchanged — verified, the employee's legitimate `September 1–15` payslip is still listed and still downloads.
- **Two new audits.** `audit-payroll-status-coherence.mjs` reports records that are payable before their period is approved, with the financial exposure. `audit-unapproved-payslip-exposure.mjs` proves it from the browser.
- **The exposure script's first verdict was wrong and was fixed.** It reported `EXPOSED` purely because an unapproved row existed, so it kept claiming exposure after the route correctly returned 403. It now derives the verdict from the actual HTTP status and from whether that specific record is listed, rather than from row presence. It also used `getByRole("button")` for a control that is an `<a>`, which silently reported zero download controls.
- Wired both audits into `verify-all`.

## Attendance timezone correctness (2026-10-07)

- **Manual attendance entries stored the wrong instant (P1 payroll data).** `lib/attendance/manage.ts` built its timestamp with `new Date(`${workDate}T${hh}:00`)`, which JavaScript parses in the *server's* local timezone. The same manager entry therefore stored a different instant depending on the host: an 08:00 Manila shift saved as `00:00Z` on a Manila dev machine but `08:00Z` (= 16:00 Manila) on a UTC production host. Two consequences: dev and prod disagreed by 8 hours for identical input, and HR-entered records drifted 8 hours out of step with `clock_event` records in the same columns — and `clock_event` already resolves `employees.default_timezone` correctly. The schema also explicitly mandates UTC storage, so the manual path was violating it.
- **Clock and shift times rendered in the server's zone.** Every display site used `format(new Date(iso), "h:mm a")`, so on a UTC host even a correct instant showed as 12:00 AM. Nine sites across `/app/my`, `/app/my/attendance`, `/app/my/schedule`, `/app/attendance`, and `/app/attendance/corrections` now use a shared formatter.
- **`lib/attendance/zoned-time.ts`** resolves wall-clock readings against the employee's IANA timezone (default `Asia/Manila`, re-resolving once so DST transitions settle correctly) and formats instants back in that zone. Write and read paths live together so they cannot drift apart again.
- **14 tests.** One asserts the result is identical across `UTC`, `Asia/Manila`, `America/New_York`, and `Pacific/Auckland` hosts. A companion test asserts the *old* `new Date()` parse really did yield two different instants across `UTC` and `Asia/Manila`, so the independence test cannot pass vacuously if mutating `process.env.TZ` ever stops affecting `Date` parsing.

## Payroll integrity, attendance corrections, mobile legibility (2026-10-07)

- **Service worker leaked authenticated pages (P0 security).** `public/sw.js` ran a blanket cache-first strategy over every same-origin GET and precached `"/app"` during install. On a shared front-desk or kiosk device, the first employee's server-rendered payslips and attendance records were written to Cache Storage and replayed to whoever signed in next. `PRECACHE` now holds only the static brand icons, and the `fetch` handler caches nothing except build-hashed `/_next/static/` chunks. Every navigation, `/api/*` request, and authed route goes straight to the network. New `tests/service-worker-cache-safety.test.ts` executes the real worker in a sandbox and drives `install`/`fetch`; it fails 5/9 against the old strategy and passes 9/9 against the new one.
- **Web app manifest had no `id`** and launched the marketing site. Browsers derive app identity from `start_url`, so any later change would have re-prompted for install alongside the existing icon. Added `id: "/app"`, pointed `start_url` at the employee workspace, and added categories.
- **Live payroll double-payment found in seeded data.** `September 1–15, 2026` (finalized, 1 record) overlaps `September 2026 payroll` (draft, 10 records) across Sept 1–15. One employee carries a finalized record in both (net 24,500 and 26,760), so the same days are paid twice. `audit-payroll-period-overlap.mjs` reports the period clash and the employee-level exposure read-only. **Not reconciled** — which period is authoritative is a business decision.
- **`payroll_periods_no_overlap` constraint written, not applied.** `createPayrollPeriod` rejected overlapping cutoffs in application code, but read-then-write is racy and there was no schema backstop. Migration `20261007120000` adds a `daterange` GiST exclusion constraint (`btree_gist`), scoped per organization. It will not apply until the overlapping rows above are reconciled. Twelve payroll tests now pin the inclusive-boundary semantics the app guard and the DB constraint must agree on.
- **Approved attendance corrections could leave payroll on stale hours (P1).** When an employee corrected only one clock time, `worked_minutes` was recomputed from the request alone, which returns null for a one-sided request. The corrected `clock_out_at` was written but `worked_minutes` kept its pre-correction value, and payroll reads `worked_minutes` directly. The effective clock pair is now the requested values merged over the record's current ones (`lib/attendance/corrected-times.ts`), and a correction that would invert the pair is refused. Eleven behavioural tests cover it.
- **Employee mobile legibility: 13/28 → 28/28.** The transactional employee sweep at 375/390/430/768 failed on `TEXT<16` for `/app/my`, `/app/my/attendance`, `/app/my/leave`, `/app/my/requests`, and `/app/my/documents` while passing every tablet and desktop viewport. Body copy on those routes was 14px (and 12px on the upload hint) on phones. Now `text-base sm:text-sm`, so phones get 16px while desktop keeps its density. No touch-target, overflow, or bleed failures at any viewport.
- **New audits wired into `verify-all`:** page wiring (dead buttons, unsubmittable forms, links to missing routes), page-inventory drift, and payroll overlap. Page wiring reports zero candidates, validated against a negative control that planted four defects and confirmed the scanner caught all four while ignoring three legitimate controls.
- **`docs/PAGE_INVENTORY.md`** generated: 91 pages and 7 route handlers with their permission gates and server-action imports. `--check` fails if it drifts.

## Production-readiness pass (2026-10-07)

- **Build gate opened.** `pnpm build` passes for the first time against current code (87 routes). `verify-all.mjs` previously printed "Ship it" without ever running the build or the linter; it now runs both, and the gate was proven to exit 1 on an injected type error.
- **Performance measured against a production build** (`pnpm build && pnpm start`, never `next dev`): 9/9 routes within budget, CLS 0.000 everywhere. Highest LCP is `/` at 1668ms, driven by the hero photograph.
- **Command palette P0 fixed.** `CommandInput/CommandList/CommandItem` rendered without a `<Command>` root, so cmdk's store was undefined and the palette threw `Cannot read properties of undefined (reading 'subscribe')` on open. Wrapped in `<Command>`.
- **Nested `<main>` landmarks fixed.** `SidebarInset` rendered a `<main>` and `app-shell` nested a second one inside it.
- **Touch targets**: `Button` gained 44px coarse-pointer floors; 18 `min-h-9` overrides across 13 files updated; header, dialog/sheet close buttons, and 10 action links corrected. **iPad overflow fixed** — `SidebarInset` needed `min-w-0` (`/app/admin/users` was 256px wider than the viewport at 768px).
- **RBAC audit corrected.** The script could not recognise `canAny(...) + forbidden()`, re-export indirection, or nested layouts, so it reported healthy pages as ungated. Now 73/76 + 3 structural exemptions, exit 0.
- **Lint unblocked** (was exit 1): wrong `SendResult` mock shape, a no-op placeholder test whose assertions lived in `beforeAll`, an unused import, and the vendored `claude-seo/` tree pulled out of the app lint scope.
- **E2E**: `owner` and `client` Playwright projects existed with no spec files and therefore asserted nothing; both now have real specs. Specs that sign in themselves moved to an `anonymous` project because a project-level `storageState` broke them. Added a console-error/uncaught-exception guard that caught the palette P0 on its first run.
- **Migration hardened, not applied.** `20261006140000` now revokes `EXECUTE` on its three `security definer` functions from `public, anon, authenticated`. It remains unapplied: no `SUPABASE_DB_PASSWORD` and the CLI token is unauthorized. Realtime stays NOT VERIFIED.
- **Docs corrected**: RBAC is 73/76 (not 76/76), the payroll engine is `fixed_salary_v1` (not `stub_v1`), and the token-rotation note was removed.

## DB apply + list pagination (2026-09-14)

- Applied `20260914120000` on Beepa project `nwvnawgxkzwiercllgmg`: attendance/CRM indexes and `supabase_realtime` publication for attendance, CRM, tickets, and job applications. Replica identity on attendance left default (follow-up only if clock-out live refresh fails).
- URL `page` + shared `ListPager` on staff tickets/employees/CRM leads/deals/leave/applicants, client tickets, and admin users. Queries use `.range` instead of a silent `.limit`.

## Shell latency + live data (2026-09-14)

- Workspace resolve now loads profile, memberships, and `user_permission_codes` in one `Promise.all` (was 3 sequential round-trips).
- App layout no longer waits on unread notification count; the bell already fetches live.
- Loading skeletons use white cards so CRM/hubs no longer look blank on `bg-mist`.
- Employee `/app/my/attendance` has Clock In / Out (same `clock_event` action as My Workspace).
- Debounced realtime refresh on attendance, CRM hub, and staff tickets. Migration `20260914120000` (indexes + `supabase_realtime`) is applied on `nwvnawgxkzwiercllgmg`.
- Header role label prefers Sales/HR over generic Employee across all memberships (not only the primary row).
- Live refresh also on client tickets, employee requests, and applicant applications (scoped filters).

## Auth + shell

Supabase Auth, employee vs client login, workspace resolution, app shell/sidebar, permission helpers (`can` / `requirePermission`), marketing + auth layouts.

**2026-09-09 — Auth UI redesign:** `/login`, `/employee/login`, and `/signup` rebuilt to match `Mockup/sign in.png` and `Mockup/sign up.png` (split brand panel + form card, values bar, mobile form-first + photo strip). Demo login pickers kept. OAuth deferred (honest copy, no decoy Google CTA). Remember-me persists email locally on client login.

**2026-09-09 — SEO / Search Console:** Favicons regenerated as real multi-size ICO + 48px PNG (Google favicon guideline). Root title/OG set to `BeepoBPO | People-First BPO Outsourcing Partner`. Organization + WebSite JSON-LD, optional `GOOGLE_SITE_VERIFICATION`, contact UTM attribution, honest “Built for growing teams” strip (no fake client logos).

## Employee pages

`/app/my` home, attendance (clock), schedule, leave, payroll self-view, requests, documents, profile, notifications, support.

## Client portal + RLS

`/app/client` tree, tenant-scoped views (`client_visible_employees`, attendance summaries), tickets, billing read, client settings; RLS helpers for client isolation.

## HR / payroll / recruitment / CRM hubs

Internal hubs: HR, payroll periods, recruitment jobs/applicants, CRM leads, clients list, tickets, reports, approvals queue.

## ATS / CRM / careers

Job posts, applications, public careers apply, applicant membership + portal, CRM lead create, stage history tables.

## Admin / reports / cron

Owner dashboard, admin users/orgs, reports snapshot, push APIs, `POST /api/jobs/cron` with `CRON_SECRET`.

## DB optimization

Indexes and covering membership lookups (`20260906001300`), applicant `membership_type`, hot-path filters for leave/tickets/jobs/attendance; clock/attendance event hardening.

## Hardening pass

- Segment layouts: `my` / `client` / `applicant` membership gates
- `safeNext` on login/callback redirects
- `audit_logs` writes via `logAudit`; insert policy `actor_user_id = auth.uid()` (`20260906001400_hardening.sql`)
- NTE create/respond + HR/employee pages
- Detail pages: employees, tickets, payroll periods, recruitment applicants
- Playwright role + a11y suites
- Documentation set under `docs/`

## UI polish + honesty pass

- FilterBar wired on hot queues; `lib/app/search-params.ts`; employees DB search via ilike + profile trgm
- Dense queues → Table + StatusBadge; ConfirmDialog on ticket/stage/leave/cash-advance mutations
- `applyFieldErrors` on RHF server actions; toast error fallbacks; cash-advance review for open review statuses
- Approvals deep links; admin hub links; client SLA tile removed; PageContainer on hubs
- Docs honesty + `docs/TEST_PLAN.md`; e2e `filters` + `mutations` specs

## Demo-harden pass (Option A)

- Fixed employees name search (`profile_id`); sanitized `ilike` filters; leave queue limit
- Approvals Review only when caller can open the queue; Approvals nav requires real queue perms
- Superadmin Jump-in is permission-filtered (no forbidden Employees/Tickets)
- Honest copy on payroll/documents/jobs/client approvals
- Seed: payroll_records, applicant application, KPIs, document metadata rows
- E2E: `demo-ready.spec.ts` + expanded filters/mutations; `docs/DEMO_SCRIPT.md`

## Product backlog slices (2026-09-07)

- Public contact → CRM via admin client
- Attendance correction review queue + Approvals deep-link
- Hire convert + invite (`convertApplicantToEmployee`)
- Storage upload + signed download (`lib/documents/actions.ts`); client insert migration `20260907140000`
- Payslip PDF download (`lib/payroll/payslip-pdf.ts` + route)
- Favicon + SEO (app/public `favicon.ico`, PNG icons, metadata icons/OG/robots, sitemap careers, JSON-LD logo)
- Job post update / publish / close (`updateJobPost`, `publishJobPost`, `closeJobPost` + `/app/recruitment/jobs/[id]`)
- Invoice detail + payments (`/app/billing`, `/app/client/billing/[id]`, `recordInvoicePayment`)
- CRM lead status update (`updateCrmLeadStatus` + `/app/crm/leads/[id]`)
- Reports CSV export (`GET /app/reports/export?dataset=…`, `reports.export`)
- Auth trust: removed decoy Google/Microsoft CTAs (email/password only until OAuth is configured)
- Auth lock: email/password confirmed as intentional path; OAuth deferred in status/docs; cash-advance audit `entityType` aligned to `cash_advance`
- Ticket assignment: `assignTicket` + `TicketAssignForm` on `/app/tickets/[id]`; assignee column on queue; Beepa internal assignee list; notify assignee
- SLA policy admin: `/app/tickets/sla` create/update Beepa `ticket_sla_policies` (`tickets.manage`); nav link under Tickets
- NTE close-out (`resolveNteCase` + `NteResolveForm` on `/app/hr/nte`; outcome on `/app/my/nte`)
- Admin invite (`inviteInternalUser` + `/app/admin/users`; shared `inviteOrResolveAuthUser`)
- Cron/push ops smoke (`lib/jobs/cron-jobs.ts` dry-run, `/app/admin` Ops smoke, `pnpm smoke:cron`); applied `20260907140000` on Beepa remote
- CMS admin (`/app/cms`, `cms.manage`) for services + blog posts; public `/services` + `/resources`/[slug]; sitemap blog URLs
- CRM deals pipeline (`createCrmDeal`, `updateCrmDealStage`, `/app/crm/deals`, lead→deal)
- CMS About + FAQs (`public_about`, `createFaq`; migration `20260907170000` for public_* RLS)
- Client org invite (`inviteClientUser` on `/app/clients`, `clients.manage`)
- Remaining CMS pages: industries, testimonials, case studies (`/case-studies`)
- E2E suite green (`pnpm test:e2e` — 34 passed) + honesty pass: removed dead Remember-me / email-pref switch; client approvals/settings/timesheets/payroll/billing empty-copy clarified; home FAQ prefers published CMS rows
- Client timesheet approval: `reviewClientTimesheet` / `submitTimesheetForClientReview`, migration `20260907180000` (`attendance_record_id` on summary + enable `allow_timesheet_approval`), UI on `/app/client/approvals` + timesheets + internal Send to client
- Demo login picker: all 13 roles on `/login` + `/employee/login` autofill (`DEMO_PASSWORD`); seed syncs Supabase Auth passwords via `updateUserById`; e2e `demo-login.spec.ts`
- CMS edit-in-place: `updateBlogPost` / `updateService` / `updateFaq` / `updateIndustry` / `updateTestimonial` / `updateCaseStudy` + `CmsEditButton` dialogs on `/app/cms`
- Invoice issue UI: `issueInvoice` + `IssueInvoiceForm` on `/app/billing` (`billing.manage`); creates `issued` invoice + line item
- Deal → client org: `convertWonDealToClient` on won deals (`crm.manage` + `clients.manage`); migration `20260907190000` adds `crm_deals.client_organization_id`
- Payroll period create: `createPayrollPeriod` + form on `/app/payroll/periods` (`payroll.manage`); optional draft `payroll_records` for active employees
- CRM proposals: `createCrmProposal` / `updateCrmProposalStatus` on `/app/crm/proposals` + deal detail; early deals bump to `proposal` stage
- Email digests: Resend HTTP send (`lib/email/send.ts`), cron `notification_digest`, pref toggle on `/app/my/notifications`; migration `20260907200000` (`email_digest_sent_at`)
- Dynamic approval workflows: `lib/approvals/engine.ts` resolves by workflow `code` + advances steps; leave/cash/attendance wired; admin read view `/app/admin/workflows`
- Current-step Approve gating: `mapPendingApprovalActability` + `canActOnApprovalStep` hide Approve on leave/cash/corrections/`/app/approvals` when the actor is not on the current workflow step (shows “Waiting for …”)
- Client ticket SLA: seed policies + `tickets_apply_sla` trigger (`20260907210000`); `evaluateTicketSla` / compliance tile on `/app/client`; SLA column on `/app/tickets`; detail badges; first staff reply sets `first_response_at`
- Auth lock: email/password confirmed as intentional path; OAuth deferred in status/docs; cash-advance audit `entityType` aligned to `cash_advance`
- Ticket assignment: `assignTicket` + `TicketAssignForm` on `/app/tickets/[id]`; assignee column on queue; Beepa internal assignee list; notify assignee
- SLA policy admin: `/app/tickets/sla` create/update Beepa `ticket_sla_policies` (`tickets.manage`); nav link under Tickets
- Account menu fix: `DropdownMenuLabel` wraps Base UI `Menu.Group` (fixes MenuGroupContext crash); header menu adds Profile / Settings / Notifications / Sign out
- Payroll period approval: `submitPayrollPeriodForApproval` + `reviewPayrollPeriod` on `/app/payroll/periods/[id]`; Finance → Owner via seeded `payroll` workflow; approvals hub deep-link
- CI permanent fix: quote `AUTH_SECRET` (YAML `!!` broke every run); e2e gated on `vars.RUN_E2E` not `secrets.*`
- Account honesty: `/app/my/settings` password; client/applicant notification inboxes; gate client Create/Reply ticket; cash advances in employee nav; payroll perms on Approvals
- Role audit: employee ticket detail `/app/my/requests/[id]`; remove clock location decoy; client profile edit; filter client Approvals nav; DB revoke anon on SECURITY DEFINER + indexes (`docs/ROLE_CHECKLIST.md`)
- Principal system audit: leave cancel `ConfirmDialog`; client portal flags (`allow_ticketing` / billing / attendance) on nav + pages + `createTicket`; honest marketing Trusted-by / ProofStrip; admin orgs/workflows view-only copy; `docs/SYSTEM_AUDIT.md` + `tests/principal-audit-p1.test.ts`
- Principal remaining P2: HR `updateEmployee` + edit form; admin membership role change + revoke (owner/super_admin protected); ConfirmDialog on payroll recalculate + send-to-client; `postTicketMessage` hard-lock when ticketing off (staff bypass); orgs/workflows stay RO; `tests/principal-remaining-p2.test.ts`
- Landing redesign: hero matches mockup (green arc + side banner + trust strip); Why Beepa copy/layout; tab title `BeepoBPO` + brand favicons regenerated from SVG
