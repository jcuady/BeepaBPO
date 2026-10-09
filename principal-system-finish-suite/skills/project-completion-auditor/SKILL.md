---
name: project-completion-auditor
description: Audit an application page by page, role by role, and feature by feature; reconcile code, behavior, tests, and documentation into an evidence-based completion status. Use to find missing, broken, inaccessible, or undocumented functionality before finishing a client system.
---

# Project Completion Auditor

Build a complete system inventory and prove what exists. Do not rely on filenames, TODO comments, or a prior status report alone.

## Discovery

Read project instructions and existing status documents. Detect the stack, applications, entry points, route definitions, API surfaces, database migrations/schema, background jobs, integrations, feature flags, tests, seed data, and deployment configuration. Preserve unrelated user changes.

Enumerate:

- every frontend page, layout, modal, drawer, form, tab, table action, button, and navigation target;
- every public landing, service, industry/use-case, case-study, contact, legal, campaign, thank-you, and error page;
- every public, authenticated, and error route;
- every API endpoint, job, webhook, scheduled task, and external integration;
- every user type, role, permission, tenant or branch boundary;
- every primary entity and lifecycle state.

When feasible, run the app and exercise representative accounts for every role. Static existence is not proof that a feature works.

## Coverage matrix

Create `docs/system-inventory.md` with one row per surface or capability:

`area | route/capability | allowed roles | UI entry | backend dependency | expected behavior | evidence | status | severity | owner/next action`

Use only these statuses:

- `verified`: observed through a meaningful test or direct execution;
- `implemented-unverified`: code exists but behavior was not proved;
- `partial`: core path exists but required states or dependencies are missing;
- `missing`: expected capability is absent;
- `blocked`: cannot verify because a specific dependency or decision is unavailable;
- `not-applicable`: excluded with a documented reason.

Cross-check both directions: every visible control must lead to valid behavior, and every supported backend capability must have an intentional UI or documented machine-only consumer. Flag dead routes, orphan endpoints, duplicated components, unreachable states, inconsistent naming, placeholder data, silent failures, and documentation drift.

For public websites, inventory each CTA and form through its downstream lead record, notification, attribution, and success state. Include metadata, canonical, robots, sitemap, structured-data, social-preview, analytics, and consent surfaces in the coverage matrix.

## Role and journey audit

Create `docs/user-role-matrix.md`. For every role, verify authentication, landing page, navigation visibility, page access, record-level authorization, allowed actions, denied actions, approval boundaries, logout/session expiry, and audit trail. Test direct URL and direct API access; hidden UI is not authorization.

Trace each critical journey through success, validation failure, server failure, retry, cancellation, empty/loading states, and recovery. Link gaps to exact routes, symbols, or reproducible steps.

## Status output

Update `docs/project-status.md` with scope, stack, evidence collected, completion by area, blockers, prioritized gaps, recent verification commands, and the next smallest safe work batch. Report separate percentages for implemented and verified work; never invent a single completion percentage from intuition.

This is an audit skill. Do not silently make broad fixes unless the user also requested implementation or invokes a fixing skill.
