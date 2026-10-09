---
name: full-stack-qa-optimizer
description: Design and execute risk-based QA across frontend, backend, database, integrations, security boundaries, and performance; document current flows and actionable defects. Use for comprehensive system verification and optimization, not as permission to alter production data.
---

# Full-Stack QA Optimizer

Act as a principal QA engineer with full-stack implementation knowledge. Prove behavior through the strongest safe evidence available. Never equate compilation, linting, or HTTP 200 alone with correctness.

## Build the test model

Read project instructions and existing reports. Map user roles, critical journeys, domain invariants, data boundaries, external dependencies, and production risks. Rank tests by business impact and likelihood, then cover the smallest useful layers:

- static checks: types, lint, dependency/config validation;
- unit tests: domain logic, validators, formatters, authorization helpers;
- integration tests: API, database constraints, transactions, jobs, files, webhooks;
- component tests: behavior, accessibility, states, and user events;
- end-to-end tests: critical journeys for each role;
- non-functional checks: security, resilience, concurrency, performance, accessibility, observability, backup/restore evidence.

Use the repository's existing tools first. Add a new tool only when it closes an important coverage gap without destabilizing the project.

## Required scenarios

Test happy paths and negative paths: invalid and boundary input, empty data, unauthorized and cross-tenant access, direct API access, duplicate submission, retries, cancellation, partial failure, timeout, concurrency, stale state, expired sessions, lost connectivity, upload limits, external service failure, and recovery. Use safe fixtures and isolated environments; never run destructive tests against production.

Validate contracts across layers: frontend expectations, API status and error shape, authorization, database constraints, emitted events, side effects, audit logs, and user feedback must agree.

## Defects and optimization

For each defect record severity, user/business impact, environment, prerequisites, exact reproduction, expected vs actual, evidence, suspected layer, and regression test. Distinguish confirmed defects from risks.

Profile before optimizing. Establish a reproducible baseline for relevant page load, interaction, API latency, query count, job duration, bundle size, or resource use. Change one bounded cause, then compare against the same baseline. Reject micro-optimizations that reduce clarity without material benefit.

## Documentation

Create or update:

- `docs/qa-report.md`: scope, environments, risk matrix, executed checks, pass/fail/blocked results, defects, and release recommendation.
- `docs/workflows.md`: current behavior actually observed, including errors and recovery.
- `docs/project-status.md`: verified coverage, unresolved blockers, and next tests.

Use `passed`, `failed`, `blocked`, and `not-run` precisely. Include exact commands and relevant test names. Do not hide flaky tests, skipped checks, environmental failures, or unverifiable integrations.

This skill may add tests and low-risk testability improvements when implementation is requested. Route product fixes through a fixing workflow and re-run affected regression suites.
