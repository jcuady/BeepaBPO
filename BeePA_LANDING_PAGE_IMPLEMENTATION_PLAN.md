# Beepa BPO — Landing Page + Authentication Implementation Plan

**Project:** Beepa BPO Corporate Website + Authentication Foundation  
**Primary Domain:** `beepabpo.com`  
**Application Route:** `beepabpo.com/app`  
**Design Direction:** Modern Human Corporate  
**Core Brand Concept:** Connected Growth  
**Primary Brand Line:** People. Partnership. Progress.  
**Document Purpose:** Give an AI coding agent or frontend team a complete, production-oriented implementation plan for the Beepa landing page, sign-in, sign-up, and the foundation for the future Beepa business platform.

---

# 1. NON-NEGOTIABLE IMPLEMENTATION ORDER

Before writing or changing UI code:

1. Read `Branding/01_MASTER_BRANDBOOK.md`.
2. Read `Branding/11_AI_IMPLEMENTATION_RULES.md`.
3. Read `Branding/Beepa_COMPLETE_BRANDBOOK.md` when additional detail is needed.
4. Inspect `Mockup/Mockup.png` for composition and section hierarchy.
5. Inspect every image inside `Assets/` before deciding placement or cropping.
6. Reuse the Beepa brand colors, typography, spacing, image direction, and logo geometry.
7. Do **not** replace the Beepa visual direction with default shadcn, generic SaaS styling, purple gradients, excessive glassmorphism, or unrelated stock-tech aesthetics.

The brandbook is the source of truth. The mockup is a visual reference, not permission to introduce fake metrics, fake companies, or fake testimonials.

---

# 2. CURRENT SCRATCH FILE SETUP

Use the current scratch structure as the source/reference layer:

```text
Assets/
├── Heroimage.png
├── logo.png
├── logo2.png
└── section image.png

Branding/
├── 01_MASTER_BRANDBOOK.md
├── 11_AI_IMPLEMENTATION_RULES.md
└── Beepa_COMPLETE_BRANDBOOK.md

Mockup/
└── Mockup.png
```

## Asset Intent

### `Assets/Heroimage.png`
Use as the primary homepage hero visual.

Requirements:
- Preserve image quality.
- Keep people naturally framed.
- Use object positioning intentionally at each breakpoint.
- Do not put important text inside the raster image if the same text belongs in semantic HTML.
- Use responsive image delivery in production.

### `Assets/logo.png`
Use as the primary horizontal Beepa logo in the desktop header and standard light-background applications.

### `Assets/logo2.png`
Use as the alternate/stacked or compact logo where the horizontal version is not appropriate, such as selected mobile, footer, authentication, or constrained compositions.

Do not rotate, recolor arbitrarily, stretch, squash, or rebuild the logo with text.

### `Assets/section image.png`
Use in the “Why Beepa / People Make Progress” section.

It should support the copy, not compete with it.

### `Mockup/Mockup.png`
Use only as a layout/composition guide.

Do **not** ship it as a website image.

Do **not** copy unverified placeholder companies, statistics, testimonials, or client logos from the mockup.

---

# 3. RECOMMENDED PRODUCTION PROJECT STRUCTURE

Keep the original scratch/reference files untouched. Build the implementation around a clean Next.js application structure.

```text
/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx
│   │   ├── about/
│   │   ├── services/
│   │   ├── careers/
│   │   ├── resources/
│   │   └── contact/
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   ├── reset-password/
│   │   │   └── page.tsx
│   │   └── verify-email/
│   │       └── page.tsx
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── api/
│   ├── layout.tsx
│   ├── sitemap.ts
│   ├── robots.ts
│   └── globals.css
│
├── components/
│   ├── marketing/
│   ├── auth/
│   ├── layout/
│   ├── ui/
│   └── beepa/
│
├── lib/
│   ├── auth/
│   ├── validation/
│   ├── seo/
│   ├── analytics/
│   └── utils/
│
├── public/
│   ├── brand/
│   │   ├── logo.png
│   │   └── logo-stacked.png
│   └── images/
│       ├── hero/
│       └── sections/
│
├── styles/
├── types/
└── middleware.ts
```

If the current scratch environment already has a project structure, integrate into that structure instead of creating duplicate folders.

---

# 4. STACK DIRECTION

Use the current stable versions supported by the project. Do not downgrade the project to match an old example.

Recommended frontend foundation:

- Next.js App Router
- React
- TypeScript with strict mode
- Tailwind CSS 4+
- shadcn/ui as open-code primitives, heavily branded to Beepa
- Base UI / current shadcn-supported primitive layer as appropriate
- React Hook Form
- Zod validation
- GSAP + ScrollTrigger only for selected marketing storytelling sections
- Lightweight CSS transitions for normal interactions
- Server Components by default
- Client Components only when interaction requires them

Recommended backend/auth foundation for the full system:

- PostgreSQL as persistent relational database
- Dedicated authentication layer compatible with RBAC and invitation flows
- Server-side sessions using secure HTTP-only cookies
- Email verification
- Password reset
- Role/permission tables designed for future Beepa system access

Do not store authentication tokens or privileged identity data in insecure local storage.

---

# 5. BRAND TOKENS

Centralize the brand. Do not scatter raw values across components.

## Core Colors

```css
--beepa-navy: #1F2058;
--beepa-green: #119446;
--beepa-lime: #93C63D;
--beepa-white: #FFFFFF;
--beepa-ink: #17182B;
--beepa-slate: #667085;
--beepa-border: #EAECF0;
--beepa-mist: #F5F7F6;
--beepa-soft-green: #EEF7E8;
```

Recommended marketing balance:

- 60% white / neutral
- 25% navy
- 10% green
- 5% lime

Lime is an accent, not a dominant page background.

## Typography

- **Manrope:** headings, display text, key statistics, buttons, major calls to action.
- **Inter:** paragraphs, form fields, labels, tables, product UI, metadata.

Use `next/font` or the project-standard optimized font loader.

---

# 6. DESIGN PRINCIPLES

The website must feel:

**Professional + Human + Editorial**

The site should communicate:

- Real people
- Trust
- Partnership
- Operational maturity
- Growth
- Philippine talent without “cheap labor” positioning

Avoid:

- Generic SaaS hero patterns
- Fake AI dashboards as the hero
- Purple/blue tech gradients
- Excessive floating cards
- Excessive glassmorphism
- Headset-call-center clichés everywhere
- Generic stock handshakes
- 3D icons
- Emoji as UI icons
- Rounded pills for every component
- Decorative charts with no business meaning

---

# 7. PUBLIC ROUTES

Minimum launch routes:

```text
/
/about
/services
/careers
/resources
/contact
/login
/signup
/forgot-password
/privacy
/terms
```

Future routes:

```text
/services/[service]
/industries
/industries/[industry]
/careers/[job]
/resources/[article]
/case-studies
/case-studies/[slug]
/app
```

Private `/app` routes must be non-indexable.

---

# 8. HEADER / NAVIGATION

## Desktop

Left:
- Beepa logo

Main navigation:
- Why Beepa
- Services
- About
- Careers
- Resources

Right actions:
- Sign In
- Primary CTA: **Build Your Team** or **Let’s Talk**

Do not overload the header.

## Mobile

- Compact Beepa logo
- Menu button with accessible label
- Sheet/drawer navigation
- Keep primary CTA visible if space allows
- Respect safe-area insets
- No horizontal scrolling
- Touch targets at least 44×44px

## Sticky Behavior

Use a subtle sticky header.

At top:
- transparent/light surface where readable

After scroll:
- white/mist background
- restrained border/shadow
- no dramatic glass blur

---

# 9. HOMEPAGE INFORMATION ARCHITECTURE

Build the homepage in this order.

## Section 01 — Hero

Use:
- `Assets/Heroimage.png`
- Logo in header only; do not duplicate oversized branding unnecessarily.

Recommended content direction:

**Eyebrow:**
`PEOPLE · PARTNERSHIP · PROGRESS`

**Headline:**
`People power better business.`

Alternative approved direction:
`Build the team your business needs to grow.`

**Supporting copy:**
Explain in one short paragraph that Beepa is a people-first outsourcing partner helping businesses build dependable teams and operate with confidence.

Primary CTA:
- **Let’s Talk** / **Build Your Team**

Secondary CTA:
- **Explore Our Services**

Micro-proof below CTA:
- People-first
- Dependable support
- Built for growth

Do not hard-code fake partner names or unverified client logos.

### Hero Layout

Desktop:
- 45–50% content
- 50–55% image
- asymmetric but balanced
- image visually anchors right side

Mobile:
- content first
- CTA immediately accessible
- image below copy
- no text over faces
- preserve readable crop

---

## Section 02 — Trust / Proof Strip

Use only verified content.

Safe launch content can include:
- Founded in 2019
- Current team size only if management approves public publication
- Geographic/service facts approved by Beepa
- Approved partner logos only

Until client approvals exist:
- do not invent brand logos
- do not show “trusted by” fake companies
- use a neutral proof statement or omit the logo strip

---

## Section 03 — Services

Headline direction:

`Outsourcing solutions for a stronger tomorrow.`

Initial service groups:
- Customer Support
- Back Office Support
- Virtual Assistants / Administrative Support
- Sales Support
- Specialized / Custom Outsourcing

Each service card:
- icon
- title
- 1–2 line outcome-focused description
- clear “Learn more” action

Do not use a generic identical 3-column grid across every section. Vary composition intentionally.

---

## Section 04 — Why Beepa

Use `Assets/section image.png`.

Recommended headline:

`A partner invested in your success.`

Four value points:
- People-First
- Reliable & Secure
- Built for Growth
- A Culture That Cares

Use the section image as the human proof point.

Keep the copy compact.

---

## Section 05 — Beepa Platform Differentiator

Purpose:
Show that Beepa provides operational visibility, without positioning itself as a software company.

Headline:

`Your team. Clearer visibility.`

Explain that future/approved Beepa clients can view their assigned workforce, attendance, timesheets, reports, requests, and communication from one platform.

Use a product mockup when a real UI exists.

Do not fabricate production analytics.

---

## Section 06 — How It Works

Suggested flow:

1. Discovery
2. Requirements
3. Talent Sourcing
4. Interview
5. Hiring
6. Onboarding
7. Ongoing Support

Use an editorial step layout or connected timeline based on Beepa logo geometry.

---

## Section 07 — Impact / Verified Metrics

Only publish numbers that Beepa has verified and approved.

Possible metrics after approval:
- Founded 2019
- Employees
- Active clients
- Average partnership duration
- Attendance/service metrics

Never ship mockup numbers such as “500+” or “98%” unless confirmed.

---

## Section 08 — Client Story / Testimonial

If authentic testimonials are available:
- real client name
- real role/company
- approved photo/logo
- short, authentic quote

If not available:
- do not generate a fake testimonial
- use a “What partnership means to us” brand-story section instead

---

## Section 09 — Careers

Headline direction:

`Build your career with people who value your growth.`

CTA:
- **Explore Careers**

Careers should connect directly to `/careers`.

Later, job listings should be backed by the ATS rather than manually duplicated in static pages.

---

## Section 10 — FAQ

Include 5–8 useful questions such as:
- What roles can Beepa help us hire?
- How does Beepa select professionals?
- Can Beepa support US business hours?
- How does onboarding work?
- Can we scale our team later?
- How do clients communicate with Beepa?
- How do we start?

Use accessible accordion behavior.

---

## Section 11 — Final CTA

Strong navy section with restrained logo-derived geometry.

Headline direction:

`Ready to build a stronger team?`

Actions:
- **Build Your Team**
- **Book a Consultation**

Do not use artificial urgency or fake scarcity.

---

## Section 12 — Footer

Include:
- Beepa logo
- short brand statement
- navigation
- services
- careers
- contact
- legal
- privacy
- terms
- social links if official
- copyright

Primary brand line may appear here:

`People. Partnership. Progress.`

---

# 10. SIGN-IN EXPERIENCE

Route:

`/login`

## UX Goal

Professional, minimal, trustworthy, and fast.

Do not make authentication pages look like a different product.

## Desktop Layout

Recommended split layout:

Left:
- Beepa brand statement
- subtle logo geometry / approved photography

Right:
- sign-in form

Mobile:
- form first
- logo and short brand statement
- no oversized decorative panel consuming viewport

## Required Fields

- Work email
- Password

## Required Actions

- Sign In
- Forgot password
- Link to Sign Up

Optional future actions:
- Continue with Google
- Continue with Microsoft

Only enable SSO when properly configured.

## Form Standards

- Visible labels
- Correct `autocomplete`
- Password visibility toggle
- Inline validation
- Disabled/loading state during submit
- Generic authentication errors that do not leak account existence
- Keyboard accessible
- Clear focus rings
- Minimum 16px input text on mobile
- No layout movement during validation

## Successful Login

Authenticated users should be routed based on authorization state:

- approved employee/client/admin → `/app`
- applicant-only account → applicant/careers area when implemented
- pending access → `/account/pending` or equivalent

Never determine privileged access from a client-side query parameter.

---

# 11. SIGN-UP EXPERIENCE

Route:

`/signup`

Beepa will contain sensitive employee, payroll, HR, and client data. Therefore **public sign-up must never allow a user to self-select privileged roles** such as Owner, HR, Finance, Sales Admin, Client Admin, or Employee Admin.

## Recommended Public Sign-Up Model

Public users may create a basic account.

Possible safe account purposes:
- Applicant
- Prospect / prospective client
- Invited client user
- Invited Beepa employee

Privileged roles must be assigned through an invitation/approval workflow.

## Basic Sign-Up Fields

- First name
- Last name
- Email
- Password
- Confirm password
- Accept Terms & Privacy

Optional:
- Company name if registering as a prospective client

Do not ask for unnecessary sensitive information at account creation.

## Required Flow

1. Submit registration.
2. Validate input server-side.
3. Create unprivileged account.
4. Send email verification.
5. Verify email.
6. Determine account state:
   - valid invite → apply invited membership/role
   - applicant → applicant profile
   - prospective client → lead/prospect flow
   - no invite → pending/basic account
7. Show clear next step.

## Invitation-Based Employee / Client Access

Recommended flow:

1. Authorized admin creates/invites user.
2. System issues signed, expiring invite token.
3. User opens invite link.
4. User creates/verifies account.
5. Server validates token.
6. Server attaches approved organization/role.
7. Audit event is recorded.
8. User enters `/app`.

Never expose role assignment as a user-editable signup field.

---

# 12. PASSWORD RESET / EMAIL VERIFICATION

Required routes:

- `/forgot-password`
- `/reset-password`
- `/verify-email`

Standards:
- expiring single-use tokens
- hashed/reset-safe token storage
- rate limiting
- generic success response on forgot-password
- no account enumeration
- invalidate reset token after use
- invalidate old sessions after password reset when appropriate

---

# 13. AUTHORIZATION FOUNDATION FOR FUTURE BEEPA APP

Authentication answers **who the user is**.

Authorization answers **what the user may do**.

Keep them separate.

Future role model:

- Owner / CEO
- Super Admin
- HR
- Recruitment
- Sales / SDR
- Marketing
- Operations
- Account Manager
- Team Leader
- Payroll / Finance
- Employee
- Client Admin
- Client Viewer
- Applicant

Internal roles remain employees first.

Example:

`HR Employee = Employee self-service permissions + HR administrative permissions`

Never create duplicate HR-personal and HR-admin accounts for the same employee.

---

# 14. CAREERS FOUNDATION

Route:

`/careers`

Minimum landing-page launch:
- employer-brand hero
- open positions area
- application CTA
- culture/values
- application process
- FAQ

Future ATS integration:

`/careers/[job]`

Applications should enter a structured pipeline:

`Applied → Screening → Interview → Assessment → Client Endorsement → Client Interview → Offer → Hired`

Do not email resumes into an unmanaged inbox as the final architecture.

---

# 15. RESPONSIVE REQUIREMENTS

The website must be designed, not merely shrunk, for each context.

Test at minimum:

- 320px small mobile
- 360–390px common mobile
- 393–430px modern large mobile
- iPhone safe-area / Dynamic Island devices
- Android devices
- 768px tablet portrait
- 1024px tablet landscape
- 1280px laptop
- 1440px desktop
- 1920px large desktop

Requirements:
- no horizontal overflow
- fluid type using `clamp()` where appropriate
- CSS Grid/Flexbox instead of fixed positioning
- `minmax()` for responsive grids
- container queries for reusable complex components where useful
- `env(safe-area-inset-*)` where relevant
- touch targets ≥44×44px
- body copy ≥16px on mobile
- preserve readable image crops
- no text overlapping faces

---

# 16. MOTION / GSAP

Use motion selectively.

Appropriate GSAP/ScrollTrigger uses:
- hero image reveal
- logo-derived connected-line reveal
- How It Works timeline
- founder/company growth story
- restrained stat reveal

Do not:
- pin every section
- scrub normal body copy
- animate forms heavily
- add motion that delays CTA access

Product/auth UI should use simple 150–300ms transitions.

Always honor `prefers-reduced-motion`.

---

# 17. COMPONENT PLAN

Create reusable Beepa components rather than page-specific duplicated markup.

## Marketing

- `SiteHeader`
- `MobileNav`
- `HeroSection`
- `TrustStrip`
- `ServiceCard`
- `WhyBeepaSection`
- `PlatformPreview`
- `ProcessTimeline`
- `MetricBlock`
- `TestimonialCard`
- `CareersCTA`
- `FAQSection`
- `FinalCTA`
- `SiteFooter`

## Brand UI

- `BeepaButton`
- `BeepaBadge`
- `SectionEyebrow`
- `LogoFrame`
- `ConnectedGrowthDecoration`
- `SectionHeading`
- `ResponsiveImageFrame`

## Auth

- `AuthShell`
- `LoginForm`
- `SignupForm`
- `PasswordField`
- `AuthDivider`
- `FormError`
- `VerificationState`
- `PendingAccessState`

Do not ship unmodified default shadcn appearance.

---

# 18. FORM SYSTEM

All forms must use one standard behavior.

Required:
- Zod schema
- server-side validation
- client-side feedback for usability
- accessible labels
- error placed near field
- form-level fallback error
- loading/submitting state
- success state
- spam/rate-limit strategy on public forms

Public lead/contact form minimum:
- name
- work email
- company
- short message / hiring need

Avoid asking for 12 fields before a prospect can contact Beepa.

---

# 19. SEO PLAN

Public marketing routes must be server-rendered/indexable where appropriate.

Implement:
- unique metadata per page
- canonical URL
- OpenGraph data
- sitemap
- robots rules
- semantic heading structure
- descriptive image alt text
- breadcrumb structured data where applicable
- Organization / ProfessionalService structured data as appropriate
- FAQ structured data only when content is visibly present and valid
- JobPosting structured data for real published career positions

Private `/app`, auth callback, reset-token, and internal routes must not be indexed.

---

# 20. ANALYTICS / CONVERSION TRACKING

Track meaningful events, not every click.

Recommended events:
- hero_primary_cta
- hero_secondary_cta
- contact_form_started
- contact_form_submitted
- careers_viewed
- job_application_started
- job_application_submitted
- login_success
- signup_completed

Capture acquisition information when appropriate:
- source
- medium
- campaign
- landing page
- referral URL

This should later feed Beepa CRM attribution.

Respect privacy/consent requirements.

---

# 21. PERFORMANCE TARGETS

Prioritize real-world performance.

Requirements:
- optimize hero image
- use responsive image sizes
- AVIF/WebP where supported
- preload only truly critical assets
- lazy load below-the-fold imagery
- reserve image dimensions to prevent CLS
- minimize client JS
- load only required icon/component code
- optimize fonts
- avoid large autoplay video in mobile hero

Targets:
- LCP < 2.5s on representative mobile conditions
- CLS < 0.1
- responsive interaction with no obvious main-thread blocking

Do not sacrifice accessibility or semantic content to chase synthetic scores.

---

# 22. ACCESSIBILITY REQUIREMENTS

Minimum WCAG-oriented baseline:

- semantic landmarks
- correct heading hierarchy
- keyboard navigation
- visible focus indicators
- labels for every form input
- labels for icon-only buttons
- alt text for meaningful images
- decorative images ignored appropriately
- sufficient contrast
- no information conveyed through color only
- screen-reader-friendly validation
- skip-to-content link
- reduced-motion support
- accessible accordions/dialogs/sheets

Never remove focus rings without providing a better accessible focus style.

---

# 23. IMAGE IMPLEMENTATION RULES

For current assets:

- keep original high-resolution sources
- create optimized production variants as part of the build pipeline when needed
- use `next/image` or current project image optimization equivalent
- define `sizes`
- use `priority` only on actual above-the-fold hero imagery
- crop responsively using CSS/object positioning
- never stretch images

Suggested production mapping:

```text
Assets/Heroimage.png
→ public/images/hero/beepa-team-hero.png

Assets/section image.png
→ public/images/sections/people-make-progress.png

Assets/logo.png
→ public/brand/beepa-logo-horizontal.png

Assets/logo2.png
→ public/brand/beepa-logo-alt.png
```

Do not delete the original scratch assets automatically.

---

# 24. CONTENT RULES

Beepa voice:

- clear
- confident
- human
- capable
- approachable
- purposeful

Do not write like an AI-generated corporate brochure.

Avoid:
- “world-class” without evidence
- “#1 BPO” without evidence
- “industry-leading” without evidence
- “500+ clients” without evidence
- invented awards
- invented partnerships
- fake quotes

Prefer:

`Build a dependable team that supports your business.`

instead of:

`Leverage synergistic offshore human-capital solutions.`

---

# 25. SECURITY BASELINE

Even though this phase is visually focused, auth must be production-minded.

Implement or plan for:
- HTTPS-only production
- HTTP-only secure session cookies
- CSRF protection according to chosen auth architecture
- password hashing with modern algorithm through auth library/backend
- rate limiting
- secure password reset
- email verification
- audit logging for privileged membership changes
- server-side authorization
- input validation
- safe error handling
- no secrets in client bundles
- environment variables validated at startup

Do not rely on hidden buttons as authorization.

---

# 26. LOADING / EMPTY / ERROR STATES

Authentication and marketing forms must include:

## Loading
- button loading state
- no double submit
- preserve layout dimensions

## Error
- human-readable explanation
- retry path
- field-specific errors when relevant

## Success
- explicit confirmation
- next action

Example:

`Thanks — your request has been received. Our team will follow up shortly.`

not merely:

`Success.`

---

# 27. IMPLEMENTATION PHASES

## Phase 1 — Audit & Foundation

- Read brand docs
- Inspect assets/mockup
- Confirm existing framework versions
- Establish tokens
- Configure fonts
- Build base layout
- Build Beepa button/input/card primitives

## Phase 2 — Header + Hero

- Responsive header
- Mobile menu
- Hero copy
- Hero image
- CTAs
- initial performance test

## Phase 3 — Homepage Content

- Trust/proof
- Services
- Why Beepa
- Platform differentiator
- How It Works
- Verified impact
- Testimonial/brand story
- Careers
- FAQ
- Final CTA
- Footer

## Phase 4 — Authentication

- Login
- Signup
- Email verification UI
- Forgot/reset password
- Pending access state
- middleware/protected route foundation

## Phase 5 — Careers Foundation

- Careers page
- jobs component structure
- application form foundation

## Phase 6 — SEO / Analytics / Performance

- metadata
- sitemap
- robots
- schema
- event tracking
- image optimization
- Core Web Vitals review

## Phase 7 — QA

- mobile
- tablet
- desktop
- keyboard
- screen reader basics
- reduced motion
- auth error states
- performance
- broken links
- no placeholder/fake proof

---

# 28. ACCEPTANCE CRITERIA

The landing page is not complete until all of the following are true.

## Brand

- [ ] Beepa logo is correctly used.
- [ ] Navy/green/lime hierarchy matches brandbook.
- [ ] Manrope + Inter roles are consistent.
- [ ] Site looks Modern Human Corporate, not generic SaaS.
- [ ] Real people are visually central.

## Landing Page

- [ ] Header works on desktop/mobile.
- [ ] Hero uses `Heroimage.png` properly.
- [ ] Hero CTA is obvious above the fold.
- [ ] Services are clear.
- [ ] Why Beepa uses `section image.png` appropriately.
- [ ] Careers CTA exists.
- [ ] FAQ exists.
- [ ] Final CTA exists.
- [ ] Footer contains legal/contact structure.
- [ ] No fake companies, testimonials, awards, or metrics.

## Auth

- [ ] Login page complete.
- [ ] Signup page complete.
- [ ] Forgot/reset password path defined.
- [ ] Email verification defined.
- [ ] Privileged role self-selection is impossible.
- [ ] Protected `/app` foundation exists.
- [ ] Loading/error/success states exist.

## Responsive

- [ ] 320px layout works.
- [ ] iPhone safe-area layout works.
- [ ] Android layout works.
- [ ] Tablet portrait/landscape works.
- [ ] Desktop 1280/1440 works.
- [ ] Large desktop works.
- [ ] No horizontal overflow.

## Accessibility

- [ ] Keyboard navigation works.
- [ ] Visible focus states exist.
- [ ] Forms have labels.
- [ ] Contrast is acceptable.
- [ ] Images have correct alt behavior.
- [ ] Reduced motion is respected.

## Performance

- [ ] Hero image optimized.
- [ ] Below-fold images lazy loaded.
- [ ] No major CLS.
- [ ] No unnecessary client JavaScript.
- [ ] Fonts optimized.

---

# 29. STRICT AI CODING INSTRUCTION

Use the following instruction when giving this project to Cursor/Claude/another coding agent:

> Act as a Principal Web Designer, Principal Frontend Engineer, and Design Systems Engineer. Build the Beepa BPO landing page and authentication foundation using the current scratch assets and Beepa brandbook as the source of truth. Before coding, read `Branding/01_MASTER_BRANDBOOK.md`, `Branding/11_AI_IMPLEMENTATION_RULES.md`, and inspect `Mockup/Mockup.png` plus every file in `Assets/`. Preserve the Modern Human Corporate / Connected Growth direction. Use the existing Beepa navy, green, lime, Manrope, and Inter system. Build a production-quality, mobile-first, fully responsive website with accessible navigation, realistic forms, proper loading/error states, SEO, optimized images, and secure authentication architecture. Create `/login` and `/signup`, but never allow public users to self-assign privileged Beepa roles. Staff and client privileged access must use invitation/approval logic. Keep `/app` protected and non-indexable. Use current stable Next.js App Router, TypeScript, Tailwind CSS 4+, and heavily customized shadcn/ui/open-code primitives where compatible with the existing project. Do not invent fake metrics, clients, testimonials, awards, or partnerships. Do not stop at a desktop mockup: verify mobile, iPhone safe areas, Android, tablet, laptop, desktop, accessibility, performance, and reduced-motion behavior. Reuse components and design tokens; do not ship default framework styling. Do not create a generic SaaS page. The final experience must be professional enough to trust, human enough to connect with, and modern enough to move forward.

---

# 30. FINAL PRODUCT INTENT

The first release should already establish the foundation for the larger Beepa ecosystem.

The user should experience one brand across:

```text
beepabpo.com
    Public marketing + SEO + careers

beepabpo.com/login
beepabpo.com/signup
    Authentication

beepabpo.com/app
    Future protected Beepa platform
```

The landing page must sell Beepa's **people and partnership** first.

The platform capability supports the service; it must not turn Beepa into a software-company brand.

The final test:

> **Professional enough to trust. Human enough to connect with. Modern enough to move forward.**
