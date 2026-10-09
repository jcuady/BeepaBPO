---
name: seo-ai-visibility-optimizer
description: Audit and implement technical SEO, on-page discoverability, structured data, crawl controls, performance, and evidence-based visibility for search and AI answer surfaces. Use for public landing pages and indexable content; not for private application routes or guaranteed ranking claims.
---

# SEO and AI Visibility Optimizer

Act as a technical SEO engineer and content-systems architect. Make public pages easy for people, search engines, and AI search systems to discover, render, understand, trust, and cite. Do not promise rankings, traffic, or inclusion in generated answers.

Before relying on crawler names, directives, structured-data support, performance thresholds, or platform behavior, check current first-party documentation. Read [references/current-guidance.md](references/current-guidance.md) for the source policy.

## Establish scope and baseline

Identify the production domain, canonical host, locales, public route inventory, target audiences, services/products, locations, conversion goals, and pages that must remain private. Inspect the rendered HTML and HTTP responses, not only framework source.

Record a baseline for crawlability, indexability, search appearance, performance, and content coverage. When access exists, use Search Console, Bing Webmaster Tools, analytics, log data, and validated field data. Keep unavailable measurements marked as unverified.

## Technical SEO

Verify every indexable page for:

- successful public response, correct redirect behavior, stable descriptive URL, and no redirect chain;
- unique descriptive title, useful meta description, canonical URL, viewport, language, favicon, Open Graph, and social preview metadata;
- correct `index`/`noindex`, robots directives, authentication boundary, and environment-specific indexing policy;
- XML sitemap containing only canonical indexable URLs and accurate last-modified data when the source can maintain it;
- discoverable internal links, useful anchor text, breadcrumbs when appropriate, and no orphan page;
- server-rendered or otherwise reliably crawlable primary content and links;
- correct status codes for deleted, missing, redirected, duplicate, and temporarily unavailable content;
- image dimensions, modern formats, responsive sources, meaningful alt text, and deferred loading that does not hide critical content;
- mobile usability, accessibility, Core Web Vitals, JavaScript/bundle cost, fonts, caching, compression, and layout stability;
- hreflang and locale canonicals only when multiple localized versions truly exist.

Keep authenticated dashboards, account pages, internal search/filter combinations, previews, staging hosts, and sensitive documents out of public indexes using the correct access or indexing control. Robots rules are crawler controls, not security boundaries.

## Structured data and entity clarity

Add only structured data that represents visible, truthful content and is supported for the page type. Prefer maintainable JSON-LD when compatible with the stack. Common candidates include `Organization`, `LocalBusiness`, `WebSite`, `BreadcrumbList`, `Service`, `Product`, `Article`, `FAQPage`, or `SoftwareApplication`, but never add a type merely because it exists.

Keep names, URLs, logos, contact details, authors, dates, prices, ratings, locations, and `sameAs` references consistent with visible content and authoritative profiles. Validate syntax and platform eligibility. Never fabricate reviews, authorship, awards, clients, statistics, or FAQs.

## AI search visibility

Treat AI visibility as strong search fundamentals plus clear, verifiable content—not as a separate magic markup layer.

- Keep important claims in crawlable text, with descriptive headings, concise direct answers, useful detail, and stable section anchors.
- State who the company is, what it does, who it serves, where it operates, and how it differs using consistent entity language.
- Support material claims with first-party evidence, case studies, dates, authorship/review ownership, specifications, and trustworthy citations where appropriate.
- Cover real customer questions, comparisons, limitations, implementation details, pricing approach, security, integrations, and support without keyword stuffing.
- Make deliberate crawler decisions for search visibility and model training. Do not conflate search crawlers with training crawlers.
- Do not add `llms.txt`, special AI schema, hidden summaries, mass-generated pages, or synthetic Q&A as a substitute for useful content. Treat experimental files as optional only when the client explicitly wants them and document that they provide no inclusion guarantee.

## Verification and output

Create `docs/seo-ai-visibility.md` with:

- public URL inventory and intended index status;
- keyword/topic and intent map tied to real pages;
- technical findings with evidence, severity, and acceptance criteria;
- metadata, canonical, sitemap, robots, structured-data, social-preview, and AI-crawler decisions;
- content gaps and evidence requirements;
- performance baseline and changes;
- validation results, remaining risks, monitoring plan, and owner actions.

When implementation is requested, use the framework's native metadata, route, image, and sitemap capabilities; avoid duplicate SEO plugins. Test production-like rendered HTML, robots and sitemap URLs, canonical consistency, structured data, social previews, broken links, and performance after changes. Separate `implemented` from `validated` and `submitted/observed` states.
