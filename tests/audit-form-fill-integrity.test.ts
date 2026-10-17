import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No audit script may fill a password with a bare `.fill()`.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * React hydrates after the server-rendered HTML is already interactive, and
 * hydration RESETS the values `fill` just wrote. A submit that lands in that
 * window sends an EMPTY form. The server then rejects it at schema validation
 * -- `loginSchema` fails, `signInWithPassword` is never called -- and the
 * exercise reports a false "sign-in failed".
 *
 * It is the worst shape of an unattributable failure, and it was measured
 * rather than reasoned about. On BeepoBeepa, 2026-10-17,
 * `finance@demo.beepabpo.com` failed to sign in with correct credentials while
 * `scripts/audit/test-auth-direct.mjs` returned HTTP 200 for all six demo
 * accounts and a burst of 36 further grants was refused zero times. The
 * credentials were never sent, so the probe was honest and irrelevant at the
 * same time, and the natural next move -- "the provider is fine, so it must be
 * the app" -- was the wrong one.
 *
 * WHY IT IS A REPO-WIDE RULE AND NOT A SINGLE-FILE FIX
 * ---------------------------------------------------
 * The same three lines appeared in roughly twenty scripts, each with its own
 * slightly different spelling. Fixing one file leaves the rest armed, and the
 * failure is intermittent by nature, so "it worked when I ran it" is not
 * evidence that any of them are safe. `fillHeld` settles, reads the field back,
 * and refuses to submit a form that is not holding its values; a value that
 * survives the settle proves hydration has finished, which is what makes it a
 * guarantee rather than another hope.
 *
 * KNOWN LIMIT, recorded so this is not over-read: the rule matches a fill whose
 * target expression names `password`. A locator held in a variable whose name
 * does not (`pwInputs.nth(i).fill(...)` on a signup form) is not covered, and
 * neither are non-credential forms. The outcome-by-DURATION half of this class
 * -- `click` followed by a fixed `waitForTimeout` with no condition wait -- is
 * a separate defect, still present in several exercises, and is recorded in
 * REMAINING_WORK 2.12c rather than claimed fixed here.
 */
const AUDIT_DIR = join(process.cwd(), "scripts", "audit");
const SCRIPTS_DIR = join(process.cwd(), "scripts");
const HELPER = "browser-form.mjs";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".mjs") || full.endsWith(".mts") ? [full] : [];
  });
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().startsWith("//")) return "";
      const idx = line.indexOf("//");
      return idx === -1 || line.slice(0, idx).includes(":") ? line : line.slice(0, idx);
    })
    .join("\n");
}

/**
 * The WHOLE of `scripts/`, not just `scripts/audit/`.
 *
 * The first sweep was scoped to `scripts/audit/` and that boundary was wrong:
 * three sibling scripts at the top level -- `audit-app-responsive.mjs`,
 * `audit-performance.mjs`, `audit-role-pages.mjs` -- sign in with the identical
 * three lines and were left exposed. A boundary drawn around a directory
 * because it seemed like where the work "lives" is not a boundary; it is a
 * subset, and the defect does not observe it.
 */
const scripts = walk(SCRIPTS_DIR)
  .filter((f) => !f.endsWith(HELPER))
  .map((file) => ({
    file: file.slice(process.cwd().length + 1).replace(/\\/g, "/"),
    code: stripComments(readFileSync(file, "utf8")),
  }));

/**
 * The inline reference implementation, excluded for the same reason the helper
 * is: it does its own verification, so its `.fill()` calls are the LOOP BODY of
 * `fillHeld`, not a bypass of it. First version of this guard flagged it, along
 * with `fillHeld(page, field, env.DEMO_PASSWORD)` elsewhere -- both because the
 * match keyed on the word `password` appearing in the call at all, which is true
 * of the VALUE as much as of the target. A guard that cannot tell what it is
 * looking at reports noise, and a guard that reports noise gets ignored.
 */
const INLINE_REFERENCE = "qa-exercise-uncovered-roles.mjs";
const scanned = scripts.filter((s) => !s.file.endsWith(INLINE_REFERENCE));

/**
 * A bare `.fill()` targeting a password field. Two shapes occur in this repo and
 * the first version of this matcher only caught the second one:
 *
 *   page.fill('input[type=password]', env.DEMO_PASSWORD)   <- password INSIDE
 *   page.locator("#password").fill(PASSWORD)               <- password BEFORE
 *
 * Matching only "password then .fill(" left the common form unguarded, and a
 * guard with a hole shaped like the most common case is worse than none: it
 * reports clean. Keying on the FIRST ARGUMENT as well as on the preceding
 * expression covers both, and neither matches `fillHeld(`, which is not `.fill(`.
 */
function barePasswordFills(code: string): string[] {
  const found = [
    // password inside the first argument
    ...[...code.matchAll(/\.fill\(\s*[^,)]*password[^,)]*\s*,/gi)].map((m) => m[0].trim()),
    // password in the locator the call is chained onto
    ...[...code.matchAll(/password[^;()]*\)?\s*\.fill\(/gi)].map((m) => m[0].trim()),
  ];
  return [...new Set(found)];
}

describe("every audit script signs in through a fill that proves the value held", () => {
  it("finds the scripts it is guarding (a vacuous pass here would be worse than none)", () => {
    expect(scanned.length).toBeGreaterThan(15);
    // Not just "there are files" -- some of them must actually contain fills,
    // or the rule below is matching nothing and passing for the wrong reason.
    const withFills = scanned.filter((s) => /\.fill\(/.test(s.code));
    expect(withFills.length, "no audit script contains a .fill() at all").toBeGreaterThan(5);
    // And most must already route through the helper, so the scan is looking at
    // the shape this rule is about rather than at a repo that never had it.
    const using = scanned.filter((s) => s.code.includes("fillHeld"));
    expect(using.length, "no audit script uses fillHeld").toBeGreaterThan(15);
  });

  it("no script fills a password with a bare .fill()", () => {
    const offenders: string[] = [];
    for (const { file, code } of scanned) {
      for (const call of barePasswordFills(code)) offenders.push(`${file}: ${call}`);
    }
    expect(
      offenders,
      "a bare .fill() on a password field can be cleared by hydration before submit; use fillHeld()",
    ).toEqual([]);
  });

  it("every fillHeld import is actually used", () => {
    const unused: string[] = [];
    for (const { file, code } of scripts) {
      if (!/import[^;]*\bfillHeld\b[^;]*from/.test(code)) continue;
      const uses = (code.match(/\bfillHeld\s*\(/g) ?? []).length;
      if (uses === 0) unused.push(file);
    }
    expect(unused, "an unused import is dead code that implies coverage that is not there").toEqual([]);
  });

  it("the helper itself refuses to submit an unheld value", () => {
    const helper = stripComments(readFileSync(join(AUDIT_DIR, "lib", HELPER), "utf8"));
    // Read back and compare. A helper that filled and hoped would make every
    // caller above it pass while fixing nothing.
    expect(helper).toContain("inputValue");
    expect(helper).toMatch(/throw new Error/);
  });
});