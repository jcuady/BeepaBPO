---
name: seo
description: >-
  Project entry for Claude SEO on Beepa/BeepoBPO. Full audits, schema, GEO,
  technical SEO, content quality. Defaults to https://beepabpo.com. Triggers on
  SEO, audit, schema, GEO, sitemap, Core Web Vitals, E-E-A-T for this product.
user-invocable: true
argument-hint: "[command] [url]"
---

# Beepa project SEO skill

This project junctions the global Claude SEO install (`~/.claude/skills/seo*`).

1. Read `.claude/seo-beepa.md` for brand, URLs, and repo rules.
2. Follow the hub skill at `~/.claude/skills/seo/SKILL.md` (or the junctioned `seo/SKILL.md` in this folder).
3. Default URL when none given: `https://beepabpo.com`.
4. Run tools via:

```powershell
& "$env:USERPROFILE\.claude\skills\seo\scripts\claude-seo.cmd" run <script.py> ...
```

If the user says `/seo audit` without a URL, audit `https://beepabpo.com`.
