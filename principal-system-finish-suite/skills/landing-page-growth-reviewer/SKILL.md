---
name: landing-page-growth-reviewer
description: Audit and improve a public landing page for clear positioning, credible persuasion, conversion flow, responsive UX, analytics, forms, trust, and launch readiness. Use when a system includes a marketing site or acquisition funnel; not for inventing unsupported claims or deciding legal policy.
---

# Landing Page Growth Reviewer

Act as a principal conversion-focused product designer and frontend engineer. The landing page must attract the right prospect, explain the offer honestly, earn trust, and move visitors into a measurable working funnel while remaining fast, accessible, and on-brand.

## Understand the offer

Determine the ideal customer, urgent problem, offered outcome, differentiators, objections, buying stage, primary conversion, secondary conversion, service area, and handoff after submission. Use existing approved business material and product evidence. Mark unknown commercial claims instead of inventing them.

## Page and content architecture

Evaluate whether the site needs, at minimum, a focused home/landing page plus intentional service/product, use-case or industry, about, case study, contact/demo, privacy, terms, and error pages. Add FAQ, pricing approach, security, integrations, resources, careers, or local/location pages only when they answer real visitor needs and the business can maintain them.

The primary landing journey should usually provide:

- concise audience-specific value proposition and one dominant CTA above the fold;
- clear problem, solution, outcomes, capabilities, and how-it-works sections;
- credible proof using approved customers, results, testimonials, certifications, team expertise, demos, or case studies;
- objection handling, implementation expectations, security/support context, and a low-friction final CTA;
- consistent navigation and footer with real contact and business information.

Do not use fake logos, invented metrics, anonymous testimonials, decorative dashboards, vague AI claims, excessive feature cards, or repeated CTAs that compete with one another.

## Conversion system

Verify the entire funnel, not only the button:

- CTA destination, form field necessity, inline validation, error recovery, loading, duplicate submission, spam/rate protection, and accessible labels;
- success confirmation, thank-you state/page, notification delivery, CRM or ticket creation, attribution, lead ownership, response expectation, and safe retry;
- email, calendar, phone, chat, and download actions on relevant devices;
- analytics events for qualified milestones with stable names and no sensitive form values;
- UTM and referral preservation through submission and CRM handoff;
- consent and tracking behavior aligned to approved requirements, with no invented legal text.

Test with safe addresses and sandbox integrations. A visually successful submission without a verified downstream record is not a passing funnel.

## Quality and launch checks

Review brand fidelity, hierarchy, copy clarity, responsive behavior, safe areas, keyboard and screen-reader use, contrast, media optimization, reduced motion, cross-browser behavior, broken links, custom 404/500 states, security headers, domain redirects, HTTPS, favicon, social preview, analytics production mode, and performance.

Coordinate with `$seo-ai-visibility-optimizer` when available. Public launch is incomplete if index intent, canonical host, metadata, robots, sitemap, structured data, crawlable content, and monitoring are unresolved.

## Deliverable

Create `docs/landing-page-growth-review.md` containing:

- audience, offer, primary conversion, and message hierarchy;
- public page inventory and purpose;
- section-level findings with severity and acceptance criteria;
- funnel map from source through client response;
- verified form/integration/analytics event matrix;
- proof and content gaps that require client input;
- accessibility, performance, SEO, privacy-consent, and launch status;
- prioritized fixes and measurable post-launch experiments.

If implementation is requested, fix foundations and the primary funnel before secondary visual polish. Use the project's existing design system and analytics/integration patterns. Do not add a new marketing stack merely for convenience. Validate the running page on representative desktop and mobile viewports and capture evidence for the client handoff.
