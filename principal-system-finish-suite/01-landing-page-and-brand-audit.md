# BeepaBPO — Landing Page & Brand Audit

**Owner:** Mavis (principal marketing / brand / video / copy)
**Repo path:** `C:\Users\jcuad\OneDrive\Documents\BeepoBeepa`
**Date:** 2026-10-06
**Scope:** Audit the current `app/(marketing)` landing page, brand system, and supporting assets. Deliver an overall brand plan and a post + ad video production plan.

---

## 0. TL;DR (the 60-second read)

**The good.** The brandbook (`Branding/BeePA_COMPLETE_BRANDBOOK.md`) is *exceptionally* well thought-out — it correctly rejects the two failure modes (generic SaaS, generic call-center), defines a real visual system (Connected Growth, Modern Human Corporate), enforces honest proof, and gives clear token rules. Whoever wrote it knows what they're doing. The codebase also already follows most of it: navy + green + lime are correct, Manrope/Inter pairing is correct, semantic colors are in place, the component split is editorial rather than card-soup, and the trust marquee + WebP pipeline are nice touches.

**The not-so-good.** The landing page is doing the *opposite* of what the brandbook says in three important places, and the rest of the site inherits that drift:

1. **Tagline is wrong.** Brandbook line 1 is "**People. Partnership. Progress.**". The site renders "**People. Process. Progress.**" in `lib/site.ts`, in the proof strip, in the footer, and almost everywhere else. That's the single most repeated phrase on the site, and it's not the brand's line.
2. **Positioning is a manpower model, not a "people-first outsourcing partner."** The brandbook says *"outsourcing partner helping businesses build dependable teams."* The site says *"Beepa is a manpower partner for BPO teams. We search, screen, and place. Payroll stays with us."* — that's staffing-vendor language, not partner language. The whole homepage reads as "we find people and pay them" instead of "we run the team with you."
3. **Hero photography is exactly the cliché the brandbook bans.** The hero, services, why-beepa, and careers photos are generic stock of headset agents in staged offices. The brandbook says: *"Do not use: Generic call-center headset rows."* The careers image is "a real Beepa employee" only by virtue of the lanyard. The hero is literally the same stock as the "Heroimage.png" the user dropped in `Assets/`.
4. **The mockup the page was meant to match (`Mockup/full landing.png`) is more aspirational than the live site.** The mockup has stats, "REAL IMPACT. LASTING PARTNERSHIPS", three testimonials, a resources section, and a confident navy CTA panel with handwritten accent. The live page has a marquee, the manpower model triad, and a FAQ. Both are legitimate layouts, but they're *different sites* — the live one is a stripped-down editorial version. That's actually fine for an MVP; what's not fine is that the brandbook wasn't applied at the level the brandbook itself demands.

The rest of this document is the deep audit, then the brand plan, then the production plan.

---

## 1. What I read

| File | What it told me |
|---|---|
| `Branding/BeePA_COMPLETE_BRANDBOOK.md` (~3440 lines) | Source of truth for positioning, voice, color, type, motion, IA, photography. |
| `Branding/01_MASTER_BRANDBOOK.md` | The condensed top-of-funnel version. |
| `Branding/11_AI_IMPLEMENTATION_RULES.md` | The "do this, not that" enforcement doc. |
| `app/(marketing)/page.tsx` | Homepage composition: Hero → Trusted-by (marquee) → Services → Why Beepa → Proof strip → Careers → Manpower model → FAQ → Final CTA. |
| `app/(marketing)/layout.tsx` | Header + footer + skip-link. |
| `app/(marketing)/why-beepa/page.tsx` | Inner page: same `PageHero` + pillars + "You/Beepa" split. |
| `components/marketing/*.tsx` (15 files) | Section components — hero, trusted-by, services, why, proof, careers, manpower model, FAQ, final CTA, platform, brand story, page hero, contact form, reveal, scroll-media. |
| `components/layout/site-header.tsx` | Sticky white header, 6 nav items, sheet on mobile. |
| `components/layout/site-footer.tsx` | 4-col footer + navy bar. Renders the `Search. Place. Pay.` triad. |
| `components/beepa/*.tsx` | `Container`, `SectionHeading`, `SectionEyebrow`, `ConnectedGrowthDecoration`, `ResponsiveImageFrame`, `focus-ring`. |
| `app/globals.css` | Tailwind v4 tokens, custom marquee, scroll-aware header. |
| `lib/site.ts` | `BRAND` constants — including the wrong tagline. |
| `lib/marketing/services-catalog.ts` | 10 services with consistent `hook` one-liners. |
| `Mockup/full landing.png`, `Mockup/landingmockup.png` | The two original "we'd love the page to look like this" mocks. |
| `public/brand/*` | Logos: horizontal, alt, mark, source, Google-organization, icon-192/512 (PNG + SVG). |
| `public/images/hero/*.png|.webp` | The hero team photo. |
| `public/images/sections/*.webp` | `why-beepa-agent.webp`, `careers-team.webp`, `people-make-progress.png`. |
| `public/images/services/*.webp` | `customer-support-floor.webp` (headset agent again). |
| `Assets/Heroimage.png` | Identical to the hero image — confirmed generic stock. |
| `public/brand/google-organization-logo-*.png` | These still show the older "BEEPA — BUSINESS PROCESS OUTSOURCING" wordmark with the more saturated lime. |

---

## 2. Brand system audit

### 2.1 Logo

- **Mark:** the interlocking two-square Connected Growth mark is strong and reads well at 32px. Stroke weight is consistent. The two-tone (green/lime) is on-brand.
- **Wordmark:** the horizontal logo (`beepa-logo-horizontal.png`) uses the brandbook's "Beepa" cap-only wordmark in navy with a small "BUSINESS PROCESS OUTSOURCING" subtitle. **Issue:** the legal entity in the brandbook is "Beepa BPO" but the brand expression is "Beepa" (lowercase intentional, two-tone mark, no suffix). The horizontal logo file commits to the full caps wordmark, which clashes with the lowercase, friendlier mark.
- **`google-organization-logo.png` and `*-112.png`:** still show the older style with the brighter, almost neon green and a heavier lime. They feel off compared to the current `beepa-logo-horizontal.png` and the CSS tokens (`#119446` / `#93C63D`). Google uses the 112px version for the Knowledge Panel — if it's still pre-token, we're sending Google a mismatched mark.
- **Source file:** `logo-source.png` is huge and clean — good, you can re-export anything from it.

**Verdict:** logo is *almost* the brand. Just need a single canonical horizontal logo, a recut of the Google-org mark to match current tokens, and a "Beepa" lowercase variant for the tight-header use case (the current header is squishing the wordmark via `max-w-[132px]` and a scale-down — it works, but a tighter lowercase version would feel more "Beepa").

### 2.2 Color

| Token | Brandbook | Code | Verdict |
|---|---|---|---|
| Beepa Navy | `#1F2058` | `--color-navy: #1F2058` | ✅ |
| Beepa Green | `#119446` | `--color-green: #119446` (interactive/text uses `--color-green-strong: #0b6e34` for AA) | ✅ Smart — interactive is darkened for contrast, brand color is preserved for accents. The brandbook tells you to do exactly this. |
| Beepa Lime | `#93C63D` | `--color-lime: #93c63d` | ✅ |
| Deep Ink | `#17182B` | `--color-ink` | ✅ |
| Slate | `#667085` | `--color-slate` | ✅ |
| Soft Gray | `#EAECF0` | `--color-line` | ✅ |
| Mist | `#F5F7F6` | `--color-mist` | ✅ |
| Soft Green | `#EEF7E8` | `--color-soft-green` | ✅ |

**Color discipline on the page:** navy dominates text, green owns CTAs and accents, lime only appears as a 1.5px dot in lists, a 3px left bar in the trust marquee, and the footer label. That's the correct ratio. **No drift on color.**

### 2.3 Typography

Manrope for display, Inter for body. Loaded via `next/font` (`--font-manrope`, `--font-inter`). All headings use `font-display`. Type scale is `clamp()`-driven. **No drift on type.**

**Minor finding:** the brandbook says "Display 48–72px / H1 40–56px / H2 32–44px." The homepage H2s are `clamp(2.25rem, 4.4vw, 3.5rem)` = 36–56px. That's fine but pushes H1 territory. The Why-Beepa page H2 is `clamp(1.75rem, 3.5vw, 2.75rem)` = 28–44px (matches the brandbook's H2). **Inconsistency between marketing sections** — the homepage sections are *slightly* over-typed for the hierarchy. Worth tightening to the brandbook's exact scale.

### 2.4 Voice

| Sample | Verdict |
|---|---|
| "People power better business." | Strong. H1. The 2-tone split (navy / green) is a recurring motif. |
| "Beepa builds dependable outsourced teams with clear support, so you can scale with confidence." | Good. Plain. Active. |
| "BPO teams that fit your process." | Good two-line trick. |
| "We find the people. You keep the process." | Decent but **already in the brandbook as an example to be careful of** — the "we do X, you do Y" staffing model is exactly the trap the brandbook warns about. |
| "Beepa is a manpower partner for BPO teams. We search, screen, and place. Payroll stays with us. The work stays on your tools." | **Regresses.** This is a 1.0 staffing-vendor pitch, not a partnership pitch. |
| "Talent on your team, paid by Beepa, who treat your work like their own." | Strong — this is closer to the brandbook's "Beepa is a people-first outsourcing partner." |
| "Search. Place. Pay." | Smart triad. **But** the brandbook's triads are "People. Partnership. Progress." and "Better Teams. Stronger Businesses." The site is using a *third* triad that doesn't appear in the brandbook. |
| "Search. Place. Pay." in the footer (replacing the brand's `People power better business`?) | Drift. |
| "Request a team" CTA | Specific, good. The brandbook explicitly praises this. |

**Voice drift:**
- The page says **"manpower"** 7+ times. The brandbook says *"Avoid or minimize: … Manpower when a better human term exists."*
- The page says **"outsourced"** once. The brandbook positions Beepa as a *people-first outsourcing partner*. The page frames Beepa as *manpower for BPO*. Different category.
- The tag of the H1 "People power better business" is closer to brand than the supporting copy. The page wins at the top, drifts in the middle, and recovers at the CTA.

### 2.5 Graphic language

`ConnectedGrowthDecoration` is the only branded graphic component on the marketing site. **It is referenced exactly once on the marketing site** — in `brand-story-section.tsx`, which isn't even on the homepage. The homepage has zero logo-derived geometry. The mockup has 3 instances (hero overlay, careers, CTA panel).

**Verdict:** underusing the strongest piece of visual identity you have. The interlocking mark is the brand's *entire* visual concept (Connected Growth, Modern Human Corporate). It should appear at minimum:
- Once on the hero (cropped curve, 3–8% opacity)
- Once on the careers band
- Once on the final CTA panel
- Once on the about page
- As a recurring motif in motion (the GSAP brandbook outlines exactly this)

### 2.6 Photography

This is where the brandbook and the page disagree hardest.

| Image | Used in | Verdict |
|---|---|---|
| `hero/beepa-team-hero.png` & `.webp` | Hero | ❌ Generic stock. 4 young Filipino professionals in a bright office, headset-free. The "Great People Build Brighter Tomorrow" poster behind them is a stock element. The brandbook says "Use real Beepa employees." |
| `services/customer-support-floor.png` & `.webp` | Services section | ❌ Single agent with headset, generic call-center stock. The exact cliché the brandbook bans. |
| `sections/why-beepa-agent.webp` | Why-Beepa | ❌ Smiling woman with headset, BEEPA lanyard, BEEPA-branded laptop sleeve, BEEPA-branded mug. AI-rendered; looks almost real but the lanyard text is wrong and the lighting is too clean. Brandbook: "Do not use … fake handshakes … overly staged diversity stock." |
| `sections/careers-team.webp` | Careers band | ❌ Same stock set as the hero, slightly different crop. |
| `sections/people-make-progress.png` | Used in mockup, not live | ❌ Stock with "People Make Progress" handwriting overlay. |

**Net:** the entire photography layer is a mix of generic stock and AI-rendered stock. The brandbook's hard rule — *"Real People. Real Work. Real Connection."* — is broken in five places.

**Why this matters more than the tagline:**
1. A B2B buyer comparing Beepa against competitors will look at the people first. The current photos look like every BPO site in 2014. It undoes the editorial design.
2. The brandbook was explicit about this. Whoever is checking the brandbook on the way in is not checking the way out.
3. It's actually fixable: Beepa has 50+ real employees (per the brandbook positioning and CMS data). A 1-day on-site shoot of 6–8 people in their real desks solves this permanently.

### 2.7 Motion

The brandbook says "use GSAP/ScrollTrigger for high-value storytelling moments." The current site uses a single `Reveal` (CSS opacity/translate on intersection) and the marquee. No GSAP. The mockup has zero motion requirements. The page is correct for an MVP — but the brandbook was written for the *next* phase, and the next phase needs the Connected Growth sequence, the founder timeline, and the platform preview reveal. Track that as a Phase 2 deliverable.

---

## 3. Landing page audit (section by section)

The homepage composes 9 sections in this order:
```
Hero → TrustedBy (marquee) → Services → WhyBeepa → ProofStrip → Careers → ManpowerModel → FAQ → FinalCTA
```

### 3.1 Hero (`components/marketing/hero-section.tsx`)

- **Eyebrow:** "People. Process. Progress." — should be "People. Partnership. Progress."
- **H1:** "People power / better business." — strong, on-brand, two-tone (navy + green). Keep.
- **Lede:** "Beepa builds dependable outsourced teams with clear support, so you can scale with confidence." — solid. Add a small *"From the Philippines"* signal for the audience clarity (US decision-makers).
- **CTAs:** "Let's Talk" (primary) + "Explore Our Services" (secondary). "Let's Talk" is weak — the brandbook says "Build Your Team" / "Book a Consultation" / "Talk to Our Team." "Let's Talk" is a clickbait habit, not a brand verb.
- **Visual:** stock team photo. Replace.
- **What it does right:** strong H1, restrained color, semantic copy, accessible focus rings, proper `priority` + `sizes` for the hero image, sharp `object-position` to push the photo into the right crop.
- **What it misses:** the brandbook's hero spec is "Build the team your business needs to grow." That's a more *commercial* H1 than "People power better business." The current H1 is a *brand* line, not a *value prop* line. **Pick one for the hero, use the other on the about page.**

**Fix list (hero):**
1. Tagline → "People. Partnership. Progress."
2. Add a quiet `Founded 2019` chip below the lede for proof without bragging.
3. CTA primary → "Build Your Team" or "Talk to Our Team" (not "Let's Talk").
4. Image → real Beepa people, framed with the Connected Growth crop mask.
5. Add a soft 3–8% opacity ConnectedGrowthDecoration in the corner.

### 3.2 Trusted-by / marquee (`trusted-by-section.tsx`)

- The marquee replaces the "trusted by client logos" rail with a "Built for growing teams" focus-areas marquee (Customer support, Back-office ops, Finance support, Recruitment, VA, Process delivery, People ops, QA).
- **Why this works:** the brandbook says *"Do not fabricate client logos."* The marquee is the honest version of the trust strip. It's the right call.
- **What could be better:** the icons + labels look a bit SaaS-template. A real Beepa proof strip should be: `Founded 2019 · 50+ professionals on client teams · 4.8★ client satisfaction · 5 industries served` — actual proof, actual numbers, set in Manrope display. The marquee can stay below as a focus-area strip.

**Fix list (trusted-by):**
1. Add a *real* proof strip above the marquee: 4 stats with verified numbers.
2. Rename from "Built for growing teams" to something more brand-resonant, e.g., "Focus areas we staff" or keep the current line.
3. The 3px lime left bar is a perfect "brand-derived micro-emphasis" use of lime. Keep.

### 3.3 Services (`services-section.tsx`)

- **H2:** "BPO teams that / fit your process." — "fit your process" reinforces the manpower framing, not the partnership framing. Reconsider.
- **Lede:** "Support, ops, IT, marketing, eLearning, and more. Beepa sources the people and runs payroll. You keep the tools, hours, and standard." — *clear and proof-led.* Brandbook-compliant. Keep.
- **Service list:** 10 services in a 2-col hairline list (not a card grid). This is the *right* pattern; it avoids card-soup. **Strong.**
- **CTAs:** "Request a team" (primary) + "All services" (secondary). Specific, on-brand.

**Fix list (services):**
1. H2: try "BPO teams that grow with your business." (partnership, not process)
2. Consider one callout ("From support to IT — see the roles we staff.") above the list.

### 3.4 Why Beepa (`why-beepa-section.tsx`)

- **H2:** "We find the people. / You keep the process." — brandbook-safe headline, but it's *manpower language*. The brandbook's example "We find the people" appears in the mockup, but the mockup's body copy is "we handle the whole team so you can focus on outcomes" — i.e., the *partnership* version.
- **You/Beepa split:** the "What you keep / What Beepa takes" pattern is great *for the brand*. It's the brandbook's clearest "professional services / clear split" move.
- **Hero image:** same AI headset agent. Replace.

**Fix list (why-beepa):**
1. Soften "We find the people" → "We run the team. You run the business."
2. Add the ConnectedGrowthDecoration in the corner.

### 3.5 Proof strip (`proof-strip.tsx`)

- **H2:** "People. Process. / Progress." — wrong triad. Should be "People. Partnership. Progress." (the brand line) **or** the proof triad should become "Better Teams. Stronger Businesses." (the marketing message) **or** the operational triad "Search. Place. Pay." (which the page already uses elsewhere).
- **Triad:** "Talent on your team, paid by Beepa, who treat your work like their own." / "Briefs, shortlists, and placement so clients and staff stay aligned from day one." / "Add roles when you need them, without restarting hiring from zero." — these are *good* proof lines. The "Talent on your team" line is the strongest single sentence on the whole site.
- **CTA:** "Request a team" / "Case studies" — good.

**Fix list (proof-strip):**
1. Replace the heading with the brandbook's "People. Partnership. Progress." or "Better Teams. Stronger Businesses." — and use *one*, not all three.
2. The "Talent on your team" line is so strong it should be promoted to the hero or the about page.

### 3.6 Careers band (`careers-band.tsx`)

- **H2:** "People we hire / people you get." — strong. Genuine. The brandbook's employer line is "Build your career with people who value your growth." — this page's H2 is the *client-facing* version of that promise. Excellent.
- **Image:** stock. Replace with a real Beepa team in their actual office.
- **CTA:** "See open roles" / "Request a team" — both specific. Good.

**Fix list (careers):**
1. Add a small "Hiring across 5+ roles" stat or "Average tenure: 3+ years" social-proof line.
2. Replace stock.

### 3.7 Manpower model (`manpower-model-section.tsx`)

- **H2:** "Search. Place. / Pay." — the operational triad. This is the *only* correct place on the site to use this triad. But it shouldn't be on the homepage — it duplicates the Why-Beepa section's "You/Beepa" split. **Recommendation:** merge it into the Why-Beepa page and replace on the homepage with a real **"How we work"** section (Discovery → Brief → Search → Interview → Place → Support).
- The "Search / Place / Pay" triad is also reinforced in the footer — too much repetition.

**Fix list (manpower-model):**
1. Move to `/why-beepa#how-we-work` and turn it into the 6-step "How we work" section (matches brandbook § 4 step 7).
2. On the homepage, replace with a **client story** or **case-study excerpt** (matches brandbook § 4 step 9 — currently missing).

### 3.8 FAQ (`faq-section.tsx`)

- 7 questions, CMS-driven (good), honest answers, no fabricated numbers.
- Brandbook says FAQ = ✅, semantic HTML = ✅, AEO = ✅. This is the strongest section on the page.
- Minor: "How do clients communicate with Beepa?" is too inside-baseball. Replace with "What does day-to-day look like after I sign?"

**Fix list (FAQ):**
1. Add 2 more AEO questions: "What is the cost of Beepa's BPO services?" and "How fast can Beepa staff a role?"
2. Add a "Still have questions? Talk to our team." inline link inside the FAQ, not just in the CTA group.

### 3.9 Final CTA (`final-cta.tsx`)

- **H2:** "Tell us the role. / We staff it." — direct, but *staffing vendor*. Brandbook: "Build Your Team" or "Talk to Our Team."
- **Visual:** no image, no decoration. The mockup's navy CTA panel with handwritten "People Partnership Progress" is much stronger. **Phase 2:** build the navy panel.

**Fix list (final CTA):**
1. Change H2 to "Build the team your business needs."
2. Add a navy background panel with the lime accent dot + ConnectedGrowthDecoration.
3. Single CTA: "Talk to Our Team."

### 3.10 Information architecture vs brandbook

Brandbook § 4 says the IA should be:
```
01 Hero → 02 Proof → 03 What Beepa does → 04 Services → 05 Why Beepa → 06 Platform →
07 How it works → 08 Industries → 09 Client story → 10 Beepa story → 11 Careers → 12 Final CTA
```

Current IA:
```
Hero → Marquee → Services → Why Beepa → Proof → Careers → ManpowerModel → FAQ → Final CTA
```

**Differences:**
- ❌ No "What Beepa does" — the page jumps from Hero to Services.
- ❌ No "Platform" section — the Beepa client portal is the brandbook's biggest differentiator (`Your team. Clearer visibility.`) and it's not on the homepage.
- ❌ No "Industries" — the brandbook has a dedicated `Industries` route and 3 industries on About; the homepage skips it.
- ❌ No "Client story" — a real testimonial is more persuasive than the FAQ.
- ❌ No "Beepa story" — the brandbook's `Built on Purpose. Growing Together.` line is nowhere on the homepage. It appears only in `brand-story-section.tsx`, which is imported by nobody.
- ❌ No "How it works" (the 6-step process) — the manpower model *partially* covers this.
- ✅ FAQ before final CTA.
- ✅ Careers before final CTA.

**Net:** the current IA is editorial-clean but it tells the brand story *badly*. It has the *components* of trust (proof, services, why, careers) but it's missing the *narrative* of trust (proof → platform → industries → client story → story → CTA). A US buyer lands, scans, and doesn't learn: (a) what Beepa is in a sentence, (b) which industries Beepa plays in, (c) what the platform actually shows, (d) what a real engagement looks like.

### 3.11 Conversion logic

- **CTAs in section order:** "Let's Talk" → "Explore Our Services" (hero) → "Request a team" + "All services" (services) → "How we staff" + "Request a team" (why) → "Request a team" + "Case studies" (proof) → "See open roles" + "Request a team" (careers) → "Request a team" + "How we staff" (manpower) → "Request a team" + "All services" (FAQ) → "Request a team" + "How we staff" (final).
- **5 unique primary CTAs:** "Request a team" appears 5 times, "Let's Talk" 1×, "Build Your Team" 0×. **The single most repeated CTA on the site is also the weakest one in the brandbook.** Brandbook CTA: "Build Your Team" > "Book a Consultation" > "Talk to Our Team."
- **Secondary CTAs:** "Explore Our Services" / "All services" / "How we staff" / "Case studies" / "See open roles" / "How we staff" — these are 4 different labels. The site has 6 nav items, 9 CTAs, 5 distinct primary actions, and 6 distinct secondaries. **Drift.**
- **Form path:** every CTA goes to `/contact`. Good. But there's no form preview on the homepage and no "Talk to Our Team" 30-second value framing.

**Fix list (conversion):**
1. Pick **one** primary CTA: "Talk to Our Team" (for top-of-funnel) or "Build Your Team" (for ready-to-buy). Use it everywhere.
2. Pick **one** secondary CTA: "See How We Work" (route to /why-beepa#how-we-work).
3. Add a 2-line microcopy under the final CTA: "30-minute call. No pitch deck. We ask about your team."

---

## 4. The 13-page master brand plan

This is the recommended plan for the next ~12 weeks. **Phase 1 = fix the drift. Phase 2 = tell the brand story. Phase 3 = the content engine.**

### Phase 1 — Fix the brand drift (Week 1)

1. **`lib/site.ts`:** change `tagline: "People. Process. Progress."` → `"People. Partnership. Progress."` — *one line of code, biggest single brand win.*
2. **All sections:** sweep for the wrong triad. Replace "People. Process. Progress." with the correct one.
3. **Hero CTA:** "Let's Talk" → "Talk to Our Team."
4. **Final CTA H2:** "Tell us the role. We staff it." → "Build the team your business needs."
5. **Manpower model section:** keep on the homepage as "How we work" but rename the H2 to "How we staff in 3 steps." Keep the triad; it's the operational truth.
6. **Footer:** change the "Search. Place. Pay." big-text to the brand line "People. Partnership. Progress." (or "Better Teams. Stronger Businesses."). Move the operational triad to the Why-Beepa page.
7. **Google Knowledge Panel logo:** re-export the horizontal logo to match the current token colors (`#119446` / `#93C63D` / `#1F2058`) and replace the 112px version.
8. **CTAs:** consolidate to 2 buttons. Primary = "Talk to Our Team". Secondary = "See How We Work".

### Phase 2 — Tell the brand story (Weeks 2–4)

1. **Photography day.** Schedule a 1-day on-site shoot. 6–8 real Beepa employees, in their real desks, doing their real work. Get 12–15 portrait/team/working shots. Update `hero/`, `services/`, `sections/` with the real assets. **This is the highest-ROI single deliverable in the entire plan.**
2. **Homepage rebuild (sections 3.1–3.9).** Order:
   ```
   Hero (with real photo + ConnectedGrowthDecoration corner)
   → Proof (4 stats)
   → Trusted-by marquee (focus areas)
   → What Beepa does (1 paragraph + 3 supporting points)
   → Services (10 services in the hairline list — keep as-is)
   → Why Beepa (4 pillars in the brandbook's pattern)
   → Platform (the client portal — biggest differentiator, currently invisible)
   → How we work (6 steps: Discovery → Brief → Search → Interview → Place → Support)
   → Industries (3 cards from CMS)
   → Client story (real testimonial or case excerpt)
   → Beepa story (Built on Purpose. Growing Together.)
   → Careers band
   → FAQ
   → Final CTA (navy panel with ConnectedGrowthDecoration)
   ```
3. **Connected Growth graphic layer.** Add the SVG decoration to: hero, careers, final CTA, about. 3–8% opacity. The brandbook says *never use all devices together in one section* — the current `ConnectedGrowthDecoration` only does "interlocking frames"; add `LimeArc` and a third `BrandPattern` component.
4. **About page.** Apply the brandbook § 6 structure verbatim. 1 editorial section. Add `Built on Purpose. Growing Together.` as the page hero.
5. **Services detail pages.** Each gets a 6-section template: What / Who for / Work supported / Why outsource / How Beepa builds / Ongoing support / Proof / FAQ / CTA. (Brandbook § 7.)

### Phase 3 — Content engine (Weeks 5–12)

1. **Case studies (3).** Real clients, real outcomes, real numbers. Brandbook § 12. Each case study is a self-contained landing page + a 90-second video (see § 6 below).
2. **Resources / blog (8 posts).** AEO-optimized, written like a partner. Topics from the brandbook § 10 (Outsourcing company Philippines, Offshore staffing Philippines, VA Philippines, Customer support outsourcing, Back-office outsourcing, Real estate outsourcing, E-commerce outsourcing, Accounting support outsourcing).
3. **Industries pages (3–5).** Real estate, e-commerce, professional services, SaaS, finance. Each one a unique page, not a near-duplicate of services.
4. **Careers refresh.** Real employee stories, real photos, real benefits (where approved). Build the "Life at Beepa" page as a *recruitment landing page*, not a generic job board.
5. **AEO/SEO infrastructure.** Schema for Organization, Services, FAQPage (already there), Reviews (when you have them), Person (for the team), JobPosting (for careers). `llms.txt` + `llms-full.txt`. JSON-LD for each case study.

---

## 5. The 9-asset brand kit (what to produce)

A complete Beepa brand kit for social + ads + sales enablement. Each item is a deliverable in `Branding/brandkit/`.

| # | Asset | Format | Use |
|---|---|---|---|
| 1 | **Primary logo lockups** | SVG + PNG @ 1x/2x/4x | Light, dark, mono, mark-only, "Beepa" lowercase, "Beepa BPO" full, "BEEPA — BUSINESS PROCESS OUTSOURCING" wordmark. 7 versions. |
| 2 | **Color tokens** | JSON + Figma vars + CSS | The 9 brand colors + 3 semantic status + WCAG contrast pairs. |
| 3 | **Typography** | .woff2 + CSS + Figma | Manrope (500/600/700) + Inter (400/500/600). Web + print. |
| 4 | **Icon library** | SVG (24px, 2px stroke) | The 8 brand icons (search, place, pay, people, partnership, progress, purpose, growth) + the 30 product UI icons. |
| 5 | **Graphic devices** | SVG | ConnectedGrowthDecoration, LimeArc, BrandPattern, InterlockingFrame. 4 devices, 3 sizes each. |
| 6 | **Photography direction** | PDF + 20 example shots | Style: bright, natural, unposed, real Beepa, editorial crops. The brandbook § 14. |
| 7 | **Social templates** | Figma + Canva (12) | LinkedIn (1200×627), Instagram (1080×1080 + 1080×1920), YouTube (1280×720), X (1600×900). 4 sizes × 3 use-cases (announcement, story, promo) = 12. |
| 8 | **Ad templates** | Figma + After Effects | Meta feed, Meta story, Reels cover, LinkedIn sponsored, Google display. 5. |
| 9 | **Video templates** | AE + CapCut | Brand bumper (3s), logo reveal (5s), lower-thirds, transitions, end-cards. 5 motion components. |

The mockup already shows pieces 7 and 8 (the dark "Partner with BeePA" panel, the testimonial card, the stat card, the service card). Re-use those patterns, but rebuild them on the current token system.

---

## 6. The post + ad video production plan

This is the principal graphic-artist / video-editor plan. BeepaBPO needs ~6 weeks of content output to fill the first 90 days of social + ad presence. The plan is split by **format** and **funnel role**.

### 6.1 Format taxonomy

| Format | Spec | Length | Best for |
|---|---|---|---|
| **Brand bumper** | 1920×1080 / 1080×1920 | 3–5s | Pre-roll on every video, end-cards on social. The brandbook's "logo reveal." |
| **Founder / origin** | 1920×1080 horizontal | 60–90s | About page, careers, brand pitch. The brandbook § 12 brand story structure. |
| **Case study** | 1920×1080 + 9:16 cut | 60–90s | Sales enablement, paid social, case-study page hero. |
| **Service explainer** | 1920×1080 + 9:16 | 30–45s | Paid social for one service, organic on LinkedIn. |
| **Employee spotlight** | 9:16 + 1:1 cut | 30–45s | Careers, employer brand, "real people" content. |
| **Quick tip / POV** | 9:16 | 15–30s | Reels, TikTok, YouTube Shorts. The "build in public" / "operator's view" genre. |
| **Testimonial** | 16:9 + 9:16 + 1:1 | 30–60s | Trust layer across all channels. |
| **Platform demo** | 16:9 screen-rec | 60–120s | Sales calls, `/platform` page, LinkedIn. |
| **Photo carousel** | Static | — | LinkedIn carousels, Instagram. The brandbook § 8 graphic devices applied to "9 lessons from our first 5 years" / "3 things to vet in a BPO partner." |

### 6.2 Hook library (10 proven hooks for BPO / outsourcing)

These are the opening 3 seconds. Each one is engineered for the platform:

1. *"Your outsourced team just disappeared overnight."* (problem/urgency)
2. *"We run a 50-person BPO from the Philippines. Here's what no one tells you."* (founder credibility)
3. *"Three things to ask a BPO before you sign the contract."* (listicle)
4. *"This is what a real Filipino support team looks like at 3am."* (b-roll reveal)
5. *"The cheapest BPO isn't the cheapest BPO."* (reframe)
6. *"We almost lost a client over a 15-minute delay. Here's what happened."* (story)
7. *"I hired my first 5 employees in 2019. Here's the playbook."* (founder POV)
8. *"If your VA disappears, it's almost always one of these five reasons."* (operator)
9. *"A day in the life of a Beepa support specialist."* (b-roll + voiceover)
10. *"What $X buys you in the Philippines in 2026."* (numbers)

### 6.3 The 30-video production plan (90 days)

| Week | Volume | Mix | Notes |
|---|---|---|---|
| 1 | 2 | 1 brand bumper, 1 founder origin | Foundation assets. The bumper is reused on every other video. |
| 2 | 4 | 1 case study, 1 service explainer, 1 employee spotlight, 1 quick tip | First batch needs the shoot. |
| 3 | 4 | 1 testimonial, 1 platform demo, 2 quick tips | Layer in the platform differentiator. |
| 4 | 4 | 2 service explainers, 1 founder POV, 1 photo carousel → 9:16 video | Service-specific paid social. |
| 5 | 4 | 1 case study, 1 testimonial, 1 employee spotlight, 1 quick tip | Second case study adds social proof depth. |
| 6 | 4 | 1 founder origin (extended), 1 platform demo, 2 quick tips | Layer up the founder content. |
| 7 | 3 | 1 case study, 1 service explainer, 1 quick tip | Mid-quarter push. |
| 8 | 3 | 1 testimonial, 1 employee spotlight, 1 quick tip | Careers push. |
| 9 | 2 | 1 platform demo (extended), 1 founder POV | Long-form sales enablement. |
| **Total** | **30** | **5 case studies, 6 service explainers, 4 employee spots, 4 testimonials, 3 founder origin, 5 quick tips, 2 platform demos, 1 brand bumper (counted once but reused 30×)** | **One of every funnel role.** |

### 6.4 Visual system for video

- **Color:** navy `#1F2058` for backgrounds (60%), white for type on navy, green for CTA moments, lime only as a 1-frame accent.
- **Type:** Manrope Bold for on-screen titles, Inter Regular for captions, Manrope 500 for lower-thirds.
- **Footage:** 1 shoot day produces enough b-roll for ~12 videos. After that, screen recordings + b-roll of Beepa desk work for the platform demos.
- **Transitions:** simple cuts, no flashy transitions, one soft "Connected Growth" wipe (the two interlocking squares slide together). Use the brandbook's `cubic-bezier(0.23, 1, 0.32, 1)` easing on every transition.
- **Audio:** soft, no copyrighted music. Use the brand's Manrope voice (if voiceover) and a quiet, mid-tempo instrumental under the b-roll.
- **Captions:** always burned in. 60–70% of social video is watched on mute.
- **End cards:** brand bumper + "Talk to Our Team" + URL.

### 6.5 The 3 video scripts (so you can see the voice)

**Script 1 — Founder origin (60s)**
> *"[0–5s, soft piano, Beepa logo in lime]*
> *In 2019, I started Beepa with one promise to my family: build something that lasts.*
>
> *[5–20s, real B-roll: a real Beepa office, real employees at their desks, real training room]*
> *That promise grew. Today Beepa is 50+ people across 5 industries. We staff support, ops, IT, and back-office teams for companies that need a partner, not just seats.*
>
> *[20–40s, founder on camera, natural light]*
> *The hardest lesson: cheap doesn't keep. We've lost 2 clients to lower-priced BPOs, and both came back in 6 months. Because the cheapest BPO isn't the cheapest BPO.*
>
> *[40–55s, real team shots]*
> *We're built on purpose. We grow with our people, with our clients, and with the businesses who trust us with their customers.*
>
> *[55–60s, brand bumper, navy panel]*
> *Beepa. People. Partnership. Progress.*
> *Talk to our team. beepabpo.com."*

**Script 2 — Case study (60s, real or composite)**
> *"[0–3s, on-screen: 'How Beepa cut response time by 62% in 90 days']*
> *[3–10s, founder voiceover over client dashboard b-roll]*
> *A US-based SaaS company came to us with 14-minute average response times and a team that was burning out.*
>
> *[10–25s, interview clips from real client + real Beepa team lead]*
> *We placed a 6-person support team in 21 days. Beepa runs the salary. They run the work.*
>
> *[25–40s, dashboard screen-rec showing the metric]*
> *In 90 days: response time dropped to 5.4 minutes. CSAT went from 78% to 91%. And the team is still in place — average tenure 18 months.*
>
> *[40–55s, client quote, large on-screen]*
> *'Beepa is an extension of our team. They feel like employees, and they deliver like owners.' — [Name], COO*
>
> *[55–60s, brand bumper, navy panel]*
> *Talk to our team. beepabpo.com."*

**Script 3 — Quick tip / POV (15s, vertical)**
> *"[0–3s, on-screen: '3 things to ask a BPO before you sign']*
> *1. Who handles payroll if the relationship ends? (You do — so make sure your people are protected.)*
> *2. Can I see real timesheets, not screenshots?*
> *3. What happens to the team at month 6?*
> *Most BPOs dodge these. The good ones answer in 30 seconds.*
> *Beepa. beepabpo.com."*

### 6.6 The 5 ad creative concepts (for paid social)

1. **"The cheapest BPO isn't the cheapest BPO."** — pattern-interrupt text on a black background, then a real Beepa team shot. 15s. Optimized for Reels / Shorts.
2. **"Three things to ask a BPO before you sign."** — see Script 3 above. Built as a static image carousel *and* a 15s video. Two deliverables from one idea.
3. **"A day in the life of a Beepa support specialist."** — 30s b-roll with a soft voiceover. 9:16 for Reels, 1:1 for feed.
4. **"Your team. Clearer visibility."** — 15s screen-rec of the Beepa platform with real-but-anonymized dashboards. Targets CFOs and COOs.
5. **"Built on purpose. Growing together."** — 30s brand film, 16:9 + 9:16 cut. The brandbook's `Built on Purpose` line brought to life with real employees.

### 6.7 Production checklist (the operational bit)

- **Day 1 (shoot day):** 6–8 real Beepa employees. 2–3 locations (real office, real desks, real meeting room). Get 12–15 portrait shots + 20+ b-roll clips. ~500–800 RAW photos, ~60–90 minutes of 4K video.
- **Day 2 (edit):** import, sync, color-grade to the brandbook's `natural light, bright, contemporary` direction. Build the brand bumper first, then re-use it on every other video.
- **Day 3–5 (cut):** cut 4–6 videos, write the burned-in captions, export in 16:9 + 9:16 + 1:1 where relevant.
- **Day 6 (QA):** brand owner (you) reviews. Brand QA = correct tokens, correct triad, real employees, no fake metrics, no AI-generated "happy diverse team" stock.
- **Day 7 (publish):** upload + schedule via your scheduler of choice. Tag every post with UTM parameters and document in `e2e-evidence/` for the marketing audit.

### 6.8 Distribution

- **Organic:** LinkedIn (primary for B2B), Instagram (employer brand), YouTube (long-form).
- **Paid:** Meta (LinkedIn → IG retargeting), LinkedIn (primary), Google (search + display on brand terms).
- **Owned:** About page, Why-Beepa, Services, Case-study pages, `/resources`, careers.

---

## 7. Prioritization matrix (what to do first)

| Priority | Item | Effort | Impact |
|---|---|---|---|
| **P0** | Fix tagline "People. Process. Progress." → "People. Partnership. Progress." across `lib/site.ts` and all sections | 1 hour | Highest — touches every page |
| **P0** | Replace "Let's Talk" with "Talk to Our Team" in hero | 15 min | High — first impression |
| **P0** | Replace "Search. Place. Pay." big-text in footer with brand line | 15 min | High — second impression |
| **P0** | Re-export Google-organization-logo-112 to match current tokens | 30 min | Medium-high — Knowledge Panel |
| **P1** | Schedule 1-day on-site photography shoot | 1 day | **Highest content ROI** |
| **P1** | Add 4-stat real proof strip above the marquee | 4 hours | High — instant credibility |
| **P1** | Rebuild homepage IA per brandbook § 4 (add platform, industries, client story, beepa story) | 2–3 days | Highest — narrative rebuild |
| **P1** | Build 9-asset brand kit (logo lockups, icons, graphic devices, social templates) | 1 week | High — enables all design/ads |
| **P2** | Add the ConnectedGrowthDecoration to hero, careers, final CTA, about | 2 hours | Medium — instant brand recognition |
| **P2** | Add 3 case-study pages with real metrics | 1 week (after shoot) | High — bottom-of-funnel |
| **P2** | Write 8 SEO/AEO articles from the brandbook § 10 topic list | 2 weeks | High — long-term acquisition |
| **P3** | Build the GSAP Connected Growth brand sequence on the about page | 3 days | Medium — premium moment |
| **P3** | 30-video production plan from § 6.3 | 6–8 weeks | High — full content engine |

---

## 8. Open questions for the brand owner

1. **Real numbers:** what's the verified proof we can put on the page? Founded 2019, headcount, industries served, average tenure, retention, CSAT. (If we don't have them, the proof strip stays a marquee.)
2. **Real clients:** who has approved a logo, a quote, or a metric? The brandbook is strict about no-fabrication. The marquee is the right MVP call, but the page will always feel like a step *before* the social proof until we have 3+ real case studies.
3. **Real employees:** are 6–8 people ready to be on camera, in their real desks, for a 1-day shoot? This is the single biggest unlock.
4. **Beepa BPO vs Beepa:** the brandbook says "Beepa" lowercase is the brand, "Beepa BPO" is the corporate entity. The site renders "BEEPA — BUSINESS PROCESS OUTSOURCING" in the logo but "Beepa" everywhere else. Which is canonical for the homepage header?
5. **Tagline canonicalization:** the brandbook is explicit ("People. Partnership. Progress."). The site is wrong ("People. Process. Progress."). The decision is to *change the site to match the brandbook*. Confirm?
6. **Industries to prioritize:** Real estate? E-commerce? SaaS? Professional services? Finance? The brandbook lists 5 candidates. Pick 3 to launch with.
7. **Platform demo permission:** can we use real (anonymized) dashboard data in the platform demo video, or do we need to recreate with mock data?

---

## 9. Final approval — does this match the brandbook?

| Brandbook rule | Current site | Verdict |
|---|---|---|
| Primary line "People. Partnership. Progress." | "People. Process. Progress." | ❌ Fix |
| 60/25/10/5 color ratio | Correct | ✅ |
| Manrope for display, Inter for body | Correct | ✅ |
| "Real People. Real Work. Real Connection." | Generic stock + AI stock | ❌ Fix |
| Modern Human Corporate + Connected Growth | Tone yes, geometry absent on homepage | ⚠️ Add Connected Growth |
| No card-soup | Hairline list (good) | ✅ |
| One primary CTA | 5 distinct CTAs | ❌ Fix |
| Do not use generic call-center headset imagery | Used in 2 sections | ❌ Fix |
| Beepa is *outsourcing partner*, not *manpower vendor* | Page reads as manpower vendor | ❌ Reposition |
| Type scale 48/40/32/24/20 | Slightly off in homepage H2s | ⚠️ Tighten |
| Avoid "manpower" when a better term exists | Used 7+ times | ❌ Fix |
| Use GSAP for high-value storytelling | Not used | ⚠️ Phase 2 |
| Public-app character mix 40/30/20/10 | Reading closer to 70/20/5/5 (services-forward, no editorial) | ⚠️ Rebalance |

**Net:** 5 ❌s, 4 ⚠️s, 3 ✅s. The bones are good. The drift is fixable in 1 week. The repositioning + photography + new IA take a quarter.

---

*End of audit. Next step: get your decisions on the 7 open questions in § 8, then we start Phase 1.*
