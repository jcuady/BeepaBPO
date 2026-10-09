<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Claude SEO

For SEO audits and GEO/schema work, use **Claude SEO v2.4.0** (global install + project context).

1. Read `.claude/seo-beepa.md`.
2. Follow `docs/seo/CLAUDE-SEO.md`.
3. Default site: `https://beepabpo.com`.
4. In Claude Code: `/seo audit https://beepabpo.com`.
5. In Cursor: load the `claude-seo` skill (and project `seo-beepa` skill).
