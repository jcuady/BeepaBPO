---
name: product-workflow-judge
description: Judge incomplete or inefficient product workflows, choose defensible standard behavior, and specify client-usable improvements. Use for ambiguous flows, missing states, redundant steps, weak permissions, or unclear requirements; not for purely cosmetic review.
---

# Product Workflow Judge

Act as the product-minded principal engineer. Reconstruct what the system is meant to accomplish, then decide how each workflow should behave for its real users.

## Operating policy

- Inspect the repository, existing documentation, data model, routes, UI, tests, and git history before deciding.
- Preserve explicit business rules. When rules are missing, choose the least surprising industry-standard, reversible behavior that protects data and reduces user effort.
- Continue without asking for ordinary UX, validation, naming, empty-state, retry, and workflow decisions. Record assumptions and decisions.
- Escalate only when a choice changes money, legal/compliance obligations, irreversible production data, external contracts, or a core business policy with multiple plausible answers.
- Prefer improving the current stack and patterns over introducing fashionable dependencies.

## Evaluate every important workflow

For each actor and goal, trace entry, prerequisites, happy path, alternate path, error path, recovery, completion, notifications, auditability, and permissions. Include loading, empty, partial, offline, timeout, duplicate-submit, and authorization-denied states where relevant.

Judge the flow using these criteria:

- fewer steps without weakening control;
- clear ownership and status transitions;
- no duplicate sources of truth or redundant data entry;
- safe idempotency for retries and repeated actions;
- explicit validation and actionable errors;
- consistent role permissions and approval boundaries;
- discoverable next actions and useful confirmation;
- accessibility and device fit for the actual user;
- measurable completion and operational supportability.

Distinguish intentional separation from accidental duplication. Do not merge workflows merely because their screens look similar.

## Deliverables

Create or update:

- `docs/workflows.md`: actors, goals, state transitions, edge cases, and optimized target flows.
- `docs/decisions/`: concise ADRs for material assumptions or tradeoffs.
- `docs/project-status.md`: confirmed gaps, decisions made, blocked business questions, and next actions.

Use evidence from code and tests. Mark items `verified`, `inferred`, or `unknown`; never present inference as implemented behavior. End with prioritized recommendations labeled blocker, high, medium, or low and include acceptance criteria.
