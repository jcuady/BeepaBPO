# Claude SEO on Beepa

Global Claude SEO **v2.4.0** is installed for this machine and wired into this repo.

## General use (any project)

Skills live under `%USERPROFILE%\.claude\skills\seo*` with agents in `%USERPROFILE%\.claude\agents\`.

Cursor also has `%USERPROFILE%\.cursor\skills\claude-seo\SKILL.md`.

```powershell
claude
# then:
/seo audit https://example.com
/seo doctor
```

Windows tooling:

```powershell
& "$env:USERPROFILE\.claude\skills\seo\scripts\claude-seo.cmd" doctor --json
```

## This project (BeepoBeepa)

| File | Role |
|------|------|
| `.claude/seo-beepa.md` | Brand, URLs, page list, implementation rules |
| `.claude/skills/seo-beepa/SKILL.md` | Project entry skill (defaults to beepabpo.com) |
| `.claude/skills/seo*` | Junctions to the global install (local only, gitignored) |
| `.claude/agents/seo-*.md` | Agent copies (local only, gitignored) |

Default production URL: **https://beepabpo.com**

## First audits to run

```text
/seo audit https://beepabpo.com
/seo page https://beepabpo.com
/seo schema https://beepabpo.com
/seo geo https://beepabpo.com
```

## Notes

- Core Python runtime: ready.
- Playwright bundled Chromium may fail to download from `cdn.playwright.dev` on this network. This install falls back to system Google Chrome via `playwright_browser.py`.
- Optional APIs (GSC, GA4, DataForSEO, etc.) are not required for core audits.
- Do not commit the `/claude-seo/` clone directory; reinstall from GitHub when updating.
