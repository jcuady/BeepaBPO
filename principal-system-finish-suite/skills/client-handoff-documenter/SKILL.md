---
name: client-handoff-documenter
description: Produce accurate technical, operational, administrator, and end-user handoff documentation from verified behavior, including page-by-page screenshots, a branded HTML manual, and a verified PDF export. Use when preparing a client-usable delivery, support transition, or acceptance package; not to invent unsupported features.
---

# Client Handoff Documenter

Create documentation that enables the client to use, administer, operate, recover, and support the delivered system without relying on tribal knowledge.

## Ground every claim

Read the code, configuration examples, schema/migrations, tests, deployment files, audit reports, and release evidence. Exercise the product when feasible. Mark features or procedures as verified, environment-specific, or pending. Do not copy stale documentation forward or include real secrets.

Use `docs/system-inventory.md` and `docs/user-role-matrix.md` when available. Reconcile them against the current routes and navigation before capture so no page is silently omitted.

## Visual page-by-page handoff

When the application has a user interface, create a visual handoff by default. Read [references/visual-handoff.md](references/visual-handoff.md) and follow its capture, HTML, PDF, privacy, and verification requirements.

Use Cursor's available browser and screenshot capability to visit the running system and capture every client-facing page. Capture role-specific or responsive variants when their content, permissions, navigation, or workflow materially differs. Do not substitute source-code screenshots or mockups for the running product.

## Handoff set

Create or update only the documents relevant to the product:

- `README.md`: purpose, architecture summary, prerequisites, local setup, configuration, and common commands.
- `docs/client-handoff.md`: delivered scope, roles, key workflows, known limits, acceptance status, support boundaries, and open items.
- `docs/client-handoff.html`: branded, navigable visual system manual with page-by-page screenshots and captions.
- `docs/client-handoff.pdf`: print-ready export generated from the HTML manual and visually verified page by page.
- `docs/admin-guide.md`: account/role management, master data, configuration, audit logs, imports/exports, and safe routine operations.
- `docs/user-guide.md`: task-oriented instructions by role with expected results and recovery from common mistakes.
- `docs/runbook.md`: deployment, health checks, monitoring, jobs, integrations, backup, tested restore, rollback, incident triage, and escalation.
- `docs/data-dictionary.md` or API documentation when the client must integrate, report, or maintain the system.
- `CHANGELOG.md` or release notes tied to the actual candidate.

Use the project's existing documentation structure when present rather than duplicating it.

## Quality rules

- Write for the intended reader and separate business use from technical operations.
- Use exact role names, routes, commands, environment-variable names, and statuses from the system.
- Redact credentials and sensitive example data; explain secure provisioning instead.
- Use synthetic or approved demonstration data in screenshots; redact personal data, secrets, tokens, internal URLs, and browser chrome that exposes them.
- Include prerequisites, expected outcome, failure signs, recovery, and escalation for operational procedures.
- State backup retention and recovery objectives only when configured or formally agreed.
- Link each known issue to impact and workaround; do not bury blockers.
- Prefer concise task flows and tables over code-centric narratives.

Finish with a handoff checklist covering screenshot coverage, HTML/PDF verification, access transfer, environment ownership, domain/DNS, email/SMS/payment accounts, backups, monitoring, licenses, source control, deployment permissions, training, acceptance, warranty/support, and unresolved risks. Items requiring the client's action must have an owner and due condition.

Do not declare handoff complete until every in-scope page has a manifest result and the HTML, screenshots, PDF pages, critical procedures, and links are checked against the release candidate.
