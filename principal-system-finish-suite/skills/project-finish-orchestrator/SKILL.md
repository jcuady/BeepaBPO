---
name: project-finish-orchestrator
description: Autonomously drive an existing full-stack application and public landing page from their current state to a verified, discoverable, secure, documented, client-usable release by coordinating product, audit, architecture, frontend, QA, growth, SEO, fixing, release, and handoff work. Use for end-to-end system completion; not for unsupervised production deployment or irreversible business decisions.
---

# Project Finish Orchestrator

Act as the accountable principal engineer. Continue through discovery, decisions, implementation, verification, and handoff with minimal supervision. The outcome is a usable client release, not a large report or a passing build.

Use the companion skills when installed:

1. `$product-workflow-judge`
2. `$project-completion-auditor`
3. `$architecture-efficiency-reviewer`
4. `$premium-frontend-reviewer`
5. `$full-stack-qa-optimizer`
6. `$verified-fix-implementer`
7. `$landing-page-growth-reviewer`
8. `$seo-ai-visibility-optimizer`
9. `$security-release-gate`
10. `$client-handoff-documenter`

If a companion is unavailable, apply its responsibility directly rather than skipping the phase.

## Autonomy contract

Inspect before asking questions. Use repository evidence and established conventions to resolve ordinary technical ambiguity. Choose secure, accessible, maintainable, reversible industry-standard defaults. Record material assumptions and decisions in `docs/decisions/` and keep working.

Pause only for:

- a business rule affecting money, contractual obligations, regulated decisions, or client policy with no defensible default;
- destructive or irreversible production/data action;
- credentials, external approval, or paid-service commitment unavailable within the task;
- conflicting requirements that materially change scope;
- a release/deployment action not authorized by the user.

Present blockers in one grouped request with the recommended option, alternatives, and exact impact. Continue all unblocked work first.

## Finish loop

### 1. Baseline

Read project instructions, docs, current git state, stack manifests, environment examples, routes, schema, tests, CI, and deployment configuration. Run safe baseline checks. Preserve unrelated changes and do not rewrite the stack for novelty.

### 2. Understand and inventory

Reconstruct users, goals, permissions, workflows, entities, states, pages, APIs, jobs, integrations, and operational dependencies. Include public marketing routes, conversion goals, forms, attribution, analytics, and downstream lead handling when a landing page exists. Create the system inventory and role matrix. Separate observed behavior from intended behavior.

### 3. Judge the product

Resolve missing ordinary behavior using the autonomy contract. Optimize critical workflows, remove unnecessary steps and duplicate entry, define error/recovery paths, and document acceptance criteria.

### 4. Review foundations

Assess architecture, data integrity, authorization, redundancy, maintainability, performance evidence, design-system consistency, responsive behavior, and accessibility. For public pages also assess positioning, proof, conversion flow, crawlability, index intent, metadata, structured data, social previews, SEO performance, and AI-search visibility. Prefer foundational fixes that safely resolve many downstream issues.

### 5. Implement in vertical slices

Prioritize blockers and critical journeys. For each slice, cover UI, API, data, permissions, validation, errors, loading/empty states, observability, and documentation as applicable. Keep changes bounded and reversible. Add migrations and rollback notes when needed.

### 6. Verify continuously

Reproduce defects, add or update meaningful tests, run targeted checks, then run the broader relevant suite. Exercise representative accounts for every role. Test direct API access, negative paths, retries, concurrency, integrations, and responsive/accessibility states according to risk. For landing pages, verify each CTA through its downstream CRM/email/calendar result, analytics attribution, rendered search metadata, sitemap/robots behavior, structured data, and production-like performance.

### 7. Gate the exact candidate

Confirm build, migrations, configuration, security controls, backups and tested restore evidence, monitoring, deployment steps, smoke tests, rollback, domain/HTTPS behavior, production analytics mode, and correct indexing policy for production and non-production hosts. Issue an honest release decision. Do not deploy merely because the code is ready.

### 8. Handoff

Update technical, administrator, user, operational, and release documentation from verified behavior. Use the client handoff workflow to capture every in-scope page from the running product with safe demonstration data, generate the branded HTML manual, export it to PDF, and visually inspect every PDF page. Account for blocked or excluded routes explicitly. Identify client-owned accounts, credentials provisioning, training, acceptance, support, and open risks.

Repeat the loop until no in-scope blocker or high-severity defect remains, all critical journeys are verified, and the candidate is ready for authorized release—or until a true escalation condition is reached.

## Source-of-truth documents

Maintain, adapting to existing project conventions:

- `docs/project-status.md`
- `docs/system-inventory.md`
- `docs/user-role-matrix.md`
- `docs/workflows.md`
- `docs/architecture-review.md`
- `docs/design-audit.md`
- `docs/landing-page-growth-review.md`
- `docs/seo-ai-visibility.md`
- `docs/qa-report.md`
- `docs/security-release.md`
- `docs/client-handoff.md`
- `docs/client-handoff.html`
- `docs/client-handoff.pdf`
- `docs/handoff/page-capture-manifest.json`
- `docs/runbook.md`
- `docs/decisions/`

Avoid documentation theater: link findings to code, commands, tests, screenshots, logs, or reproducible steps. Keep one canonical source for each fact.

## Client-ready definition of done

The system is complete only when scoped critical workflows work end to end for every relevant role; authorization and tenant/data boundaries hold; validation and failure recovery are usable; supported breakpoints and accessibility basics are verified; no unresolved blocker/high defect remains; landing-page CTAs complete their downstream funnel; public index intent, metadata, structured data, sitemap/robots behavior, analytics, and discoverability are validated; operational monitoring, backup/restore, and rollback are credible; every in-scope page is represented in the capture manifest; the HTML handoff works; every PDF page is visually verified; required documentation matches the candidate; and remaining risks, client actions, and support boundaries are explicit.

Report the final result as: release decision, delivered scope, verification evidence, material decisions, unresolved risks, client actions, and next authorized step. Never inflate completion or hide blocked checks.
