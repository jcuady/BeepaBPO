# Principal System Finish Suite

Eleven portable agent skills for taking an existing full-stack application and public landing page from an uncertain state to a verified, discoverable, secure, documented, client-usable release with minimal supervision.

## Skills

| Skill | Responsibility | Typical output |
| --- | --- | --- |
| `project-finish-orchestrator` | Runs the complete finish loop and coordinates the other responsibilities | Release decision and continuously updated project records |
| `product-workflow-judge` | Decides sensible standard workflows and fills ordinary requirement gaps | `docs/workflows.md`, decision records |
| `project-completion-auditor` | Inventories every page, role, action, endpoint, job, and integration | System inventory, role matrix, evidence-based status |
| `architecture-efficiency-reviewer` | Finds redundancy, complexity, weak boundaries, and measured bottlenecks | Architecture review and migration priorities |
| `premium-frontend-reviewer` | Enforces branded, polished, responsive, accessible, non-generic UI | Design audit and design-system contract |
| `full-stack-qa-optimizer` | Tests frontend, backend, data, integrations, resilience, and performance | QA report, regression coverage, verified flows |
| `verified-fix-implementer` | Implements findings in safe, testable batches | Code fixes, regression tests, updated status |
| `landing-page-growth-reviewer` | Validates positioning, proof, CTA flow, forms, attribution, analytics, and launch readiness | Landing-page growth review and verified funnel matrix |
| `seo-ai-visibility-optimizer` | Implements technical SEO and evidence-based visibility across search and AI answer surfaces | URL/index map, SEO/AI visibility report, validated metadata and crawl controls |
| `security-release-gate` | Checks security, operations, backup/restore, deployment, and rollback | GO / CONDITIONAL GO / NO-GO / UNVERIFIED decision |
| `client-handoff-documenter` | Captures every in-scope page and produces accurate client, user, admin, support, and operations material | Screenshot manifest, branded HTML/PDF handoff, guides, runbook |

## Install

Copy each folder inside `skills/` into the skill directory recognized by your coding agent. Keep the folder structure intact so every skill contains its own `SKILL.md` and `agents/openai.yaml`.

Common project-level locations are:

- Codex: `.codex/skills/<skill-name>/`
- Cursor: `.cursor/skills/<skill-name>/`
- Claude Code: `.claude/skills/<skill-name>/`

If your agent uses a different skills directory, use that product's current documentation. Repository-level installation is recommended for client projects because the team can version the exact workflow with the code. Do not copy these folders over unrelated existing skills with the same names without reviewing the differences.

## Recommended use

### A. Finish the whole system

Invoke the orchestrator from the repository root:

```text
Use $project-finish-orchestrator to finish this system end to end with minimal supervision.

Treat the current repository and its project instructions as the source of truth. Inspect first, then make standard, secure, reversible product and engineering decisions without asking me about routine details. Preserve existing business rules and unrelated changes. Audit every page, role, workflow, API, database path, job, and integration; remove proven redundancy; improve the frontend without generic AI styling; implement fixes in safe vertical slices; test the frontend and backend; update status and handoff documentation; and stop before production deployment.

Only ask me about a decision involving money, legal/compliance policy, irreversible production data, missing credentials or external approval, conflicting scope, or a core business rule with no defensible standard default. Group blockers into one concise request after completing all unblocked work.
```

The orchestrator is the default entry point. It calls out the companion responsibilities in the correct order and repeats audit, fix, and verification until the release criteria are met or a real blocker remains.

### B. Resume an unfinished autonomous pass

```text
Use $project-finish-orchestrator. Read the existing docs/project-status.md and audit documents, verify what is still true against the repository, then continue from the next unblocked priority. Do not repeat completed work without evidence that it regressed.
```

### C. Run a focused pass

Invoke one skill when the scope is intentionally narrow:

```text
Use $project-completion-auditor to inventory every route, role, action, endpoint, and integration and produce an evidence-based completion status. Do not implement fixes yet.
```

```text
Use $premium-frontend-reviewer to audit and refine all authenticated dashboards for our existing brand, responsive behavior, accessibility, and visual consistency. Preserve functionality and verify representative breakpoints.
```

```text
Use $full-stack-qa-optimizer to test the critical journeys for every role, including direct API authorization, validation, retries, external failures, and regressions. Update the QA and workflow documentation with exact evidence.
```

```text
Use $landing-page-growth-reviewer to audit and improve the public landing page, messaging, credibility, CTA flow, forms, CRM/email/calendar delivery, attribution, analytics, privacy-consent requirements, responsiveness, and launch readiness.
```

```text
Use $seo-ai-visibility-optimizer to audit and implement technical SEO and AI-search visibility for every public page. Verify crawlability, index intent, canonicals, metadata, sitemap, robots, structured data, social previews, internal links, performance, and deliberate search-versus-training crawler policy. Do not promise rankings or add unsupported AI SEO files.
```

```text
Use $verified-fix-implementer to resolve all blocker and high-severity findings in the current audit documents. Work in bounded batches, add regression tests, and update status after each verified batch.
```

```text
Use $security-release-gate to evaluate the exact release candidate. Do not deploy it. Return a GO, CONDITIONAL GO, NO-GO, or UNVERIFIED decision with evidence.
```

```text
Use $client-handoff-documenter to open the running system with Cursor's browser tools, screenshot every in-scope page for the correct roles, build a branded HTML client manual, convert it to PDF, and visually verify every PDF page. Use only safe demonstration data and account for every route in the capture manifest.
```

## Minimum project context

For the best autonomous result, keep these in the repository when available:

- project instructions such as `AGENTS.md`, `CLAUDE.md`, or equivalent;
- brand book, screenshots, design tokens, or a reference design;
- `.env.example` with descriptions but no real secrets;
- test accounts or seed instructions for every role in a safe environment;
- expected deployment topology and external integration sandbox details;
- known business rules, client acceptance criteria, and out-of-scope items.

Missing routine detail is not a reason for the skills to stop. Missing production access, a regulated business policy, or an irreversible migration decision is.

## Expected documentation contract

The suite maintains one source of truth per concern, adapting to an existing equivalent instead of duplicating it:

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

These are living engineering records, not completion theater. Findings should link to code, tests, commands, logs, screenshots, or reproducible steps. A feature is not `verified` merely because code exists.

## Safe autonomy

The suite deliberately distinguishes engineering judgment from business authority. It can choose conventional validation, accessible interaction patterns, error handling, component structure, indexing, test coverage, logging, and other reversible technical defaults. It must not independently approve spending, change contracts, invent regulated policies, destroy production data, use unavailable credentials, or deploy to production unless the user explicitly authorizes that action.

## Suggested cadence

For a large system, let the orchestrator complete one vertical slice at a time and commit or checkpoint after verified batches according to your repository policy. Review the release decision and client actions at the end, not every routine implementation choice.
