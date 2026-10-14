// No committed credentials.
//
// Regression guard. On 2026-10-06 `docs/AUDIT-2026-10-06.md` was committed with
// a real `VAPID_PRIVATE_KEY` and a real `DEMO_PASSWORD` in plaintext. GitGuardian
// flagged both on a public repository. Nothing about the codebase noticed: the
// value is inert to the type checker, the test runner and the build, so it sat
// there until an external scanner found it.
//
// This test is the reason that cannot happen again silently. It walks every
// tracked file and fails on credential-shaped LITERALS — an assignment with a
// real-looking value. `process.env.X` references and documentation placeholders
// are not credentials and must not fail the build.
//
// It only covers the working tree. It cannot un-expose what is already in git
// history, which is why rotation (not deletion) is the actual remedy.

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");

/** Name -> regex whose capture group 1 is the candidate secret value. */
const SECRET_ASSIGNMENTS: Array<[string, RegExp]> = [
  ["VAPID private key", /VAPID_PRIVATE_KEY\s*[:=]\s*["'`]?([A-Za-z0-9_-]{32,})/],
  ["VAPID public key", /VAPID_PUBLIC_KEY\s*[:=]\s*["'`]?([A-Za-z0-9_-]{60,})/],
  ["Supabase service role", /(?:SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*["'`]?([A-Za-z0-9._-]{40,})/],
  ["Supabase access token", /SUPABASE_ACCESS_TOKEN\s*[:=]\s*["'`]?(sbp_[A-Za-z0-9_-]{20,})/],
  ["Supabase DB password", /SUPABASE_DB_PASSWORD\s*[:=]\s*["'`]?([^\s"'`]{8,})/],
  ["Demo password", /DEMO_PASSWORD\s*[:=]\s*["'`]?([^\s"'`]{8,})/],
  ["SMTP / email password", /(?:SMTP|COMPANY_EMAIL|EMAIL|MAIL|GMAIL|OUTLOOK)_?PASSWORD\s*[:=]\s*["'`]?([^\s"'`]{8,})/],
  ["AUTH_SECRET", /AUTH_SECRET\s*[:=]\s*["'`]?([A-Za-z0-9!@#$%^&*._-]{20,})/],
  ["CRON_SECRET", /CRON_SECRET\s*[:=]\s*["'`]?([A-Za-z0-9!@#$%^&*._-]{16,})/],
  ["Resend API key", /RESEND_API_KEY\s*[:=]\s*["'`]?(re_[A-Za-z0-9_-]{20,})/],
];

/** Values that look like a credential but are not one. */
const NON_SECRETS = [
  /^process\.env/,      // a reference to the environment, not a value
  /^\$\{/,              // a template reference
  /^z\./,               // a zod schema expression: `DEMO_PASSWORD: z.string()`
  /^<.*>$/,             // <your-db-password>
  /^your/i,
  /^placeholder/i,
  /^changeme/i,
  /^example/i,
  /^\.\.\.$/,
  /^xxx/i,
  /^\[object /,
  /^(true|false|null|undefined)$/i,
  // CI declares obvious throwaway values inline; they grant access to nothing.
  /beepa-ci-secret-change-me/,
  /ci_placeholder/,
];

const TEXT_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|md|txt|yml|yaml|json|sql|example|env)$/i;

function trackedTextFiles(): Array<{ path: string; text: string }> {
  const out = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
  const files = out.split("\n").filter(Boolean).filter((f) => TEXT_FILE.test(f));
  const results: Array<{ path: string; text: string }> = [];
  for (const path of files) {
    try {
      results.push({ path, text: readFileSync(resolve(ROOT, path), "utf8") });
    } catch {
      /* unreadable or binary — not scannable, so not this test's business */
    }
  }
  return results;
}

describe("committed credentials", () => {
  test("no tracked file contains a credential literal", () => {
    const findings: string[] = [];

    for (const { path, text } of trackedTextFiles()) {
      text.split(/\r?\n/).forEach((line, i) => {
        for (const [name, re] of SECRET_ASSIGNMENTS) {
          const m = line.match(re);
          if (!m) continue;
          const value = m[1];
          if (NON_SECRETS.some((rx) => rx.test(value))) continue;
          // Report a fingerprint, never the value — this failure message ends
          // up in CI logs, which are as public as the repository.
          findings.push(
            `${path}:${i + 1}  ${name}  (len ${value.length}, fp ${value.slice(0, 3)}…)`,
          );
        }
      });
    }

    expect(
      findings,
      `Credential literal(s) committed to the repository:\n  ${findings.join("\n  ")}\n\n` +
        `Rotate the credential first — it is already public — then move it to .env.local / Vercel.`,
    ).toEqual([]);
  });

  test(".env.local is never tracked", () => {
    const out = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
    const trackedEnv = out.split("\n").filter((f) => /^\.env($|\.)/.test(f) && f !== ".env.example");
    expect(trackedEnv, `These env files are tracked: ${trackedEnv.join(", ")}`).toEqual([]);
  });
});