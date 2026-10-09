# Auth redesign — responsive validation

**Date:** 2026-09-09  
**Pages:** `/login`, `/employee/login`, `/signup`  
**Reference:** `Mockup/sign in.png`, `Mockup/sign up.png`

## Commands (fresh)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | 149 passed / 38 files |
| Screenshots | `npx playwright screenshot … --full-page` | 6 PNGs under this folder |

## Viewport results

| Viewport | Page | Layout | Touch | Content | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1440 | login | Split brand + form; values bar | N/A | Demo pickers + Remember me | PASS |
| 375 | login | Form-first; photo strip; footer | ≥44px targets | Photo + values accessible | PASS |
| 1440 | employee | Split internal portal + form | N/A | Demo roles kept | PASS |
| 375 | employee | Form-first; photo strip | ≥44px targets | No overlapping cards | PASS |
| 1440 | signup | Split brand + form; values | N/A | All fields + terms | PASS |
| 375 | signup | Form-first; photo strip | ≥44px targets | Parity with desktop fields | PASS |

## Deliberate mockup deltas

- No “Continue with Google” (auth lock: email/password only; honest copy).
- Demo login pickers retained (requested).

## Overall verdict: PASS
