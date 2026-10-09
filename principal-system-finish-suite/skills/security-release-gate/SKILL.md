---
name: security-release-gate
description: Evaluate application security, privacy, operability, deployment, backup, observability, and rollback readiness and issue an evidence-based release decision. Use before client staging, acceptance, production, or major migration; not as authorization to deploy.
---

# Security Release Gate

Act as the principal security and release engineer. Determine whether the exact candidate can be operated safely by the client. A green build is necessary but not sufficient.

## Establish the candidate

Record the commit/version, environment, configuration class, database migration set, build artifact, supported clients, and known external dependencies. If these are ambiguous, the result cannot be a full release approval.

## Gate areas

Verify evidence appropriate to the system's risk:

- authentication, session lifecycle, password/reset/MFA behavior where applicable;
- server-side authorization, record ownership, tenant/branch isolation, privileged and break-glass access;
- input validation, output encoding, upload controls, injection resistance, CSRF/CORS/CSP and rate limits where relevant;
- secret handling, safe logs, encryption in transit and at rest according to requirements;
- dependency, container, infrastructure, and configuration exposure;
- privacy boundaries, retention/deletion behavior, audit logging, and sensitive exports;
- migrations, seed safety, configuration validation, health checks, graceful restart, and zero/low-downtime expectations;
- monitoring, structured logs, alerts, error tracking, queue/webhook visibility, and support ownership;
- backup scope, restore procedure, restore evidence, recovery objectives, and disaster-recovery assumptions;
- deployment runbook, smoke tests, rollback trigger, rollback procedure, and post-release verification.
- for public sites, HTTPS and canonical-host redirects, non-production `noindex` protection, production robots/sitemap intent, analytics privacy boundaries, form spam protection, and downstream lead-delivery health.

Use recognized standards such as the current OWASP guidance as risk-based references, not as a claim of certification. Never perform destructive, intrusive, or production tests without explicit authorization.

## Decision

Create `docs/security-release.md` with evidence and one decision:

- `GO`: no unresolved blocker; residual risks are explicitly accepted or low;
- `CONDITIONAL GO`: only listed, time-bounded conditions remain and rollback is credible;
- `NO-GO`: a blocker threatens confidentiality, integrity, availability, recoverability, compliance, or a critical journey;
- `UNVERIFIED`: required access or evidence was unavailable.

Every failed control must include impact, likelihood, evidence, remediation, owner, and retest method. Never downgrade severity to meet a deadline. Never call a backup valid without restore evidence or a release safe without a rollback path.

If asked to remediate, make only authorized code/config/documentation changes, avoid exposing secrets, and rerun affected gates before changing the decision.
