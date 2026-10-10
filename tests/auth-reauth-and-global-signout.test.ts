import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "@/lib/validation/auth";
import { signupErrorMessage } from "@/lib/auth/error-messages";

/**
 * Two security defects in the auth layer, both found by driving the real UI.
 *
 * 1. CWE-620, Unverified Password Change.
 *    `changePasswordAction` validated only the NEW password and then called
 *    `supabase.auth.updateUser({ password })`. supabase-js treats a live session
 *    as sufficient authority to rotate the credential, so any session — including
 *    one from a shared or hijacked browser — could reset the account password and
 *    lock the real owner out permanently. The Settings form had no
 *    current-password field to collect the proof even if the action wanted it.
 *
 * 2. `logoutAllAction` was unreachable.
 *    It is the ONLY path that revokes refresh tokens on the user's other devices.
 *    Nothing outside its own definition referenced it, so a user who suspects a
 *    stolen session had no way to revoke it — they could only sign out of the one
 *    browser they were looking at, which is precisely the browser in doubt. The
 *    changelog claimed the global path was "reachable only on purpose"; it was
 *    reachable never.
 */

const actions = readFileSync(join(process.cwd(), "lib/auth/actions.ts"), "utf8");
const changePasswordForm = readFileSync(
  join(process.cwd(), "components/app/settings/change-password-form.tsx"),
  "utf8",
);

/**
 * Strip comments before scanning, whole-line `//` FIRST.
 *
 * Order matters. Stripping block comments first lets a line-such-as-this one pair
 * its inline slash-star with the next closing marker far below and delete the real
 * code in between. A different harness in this repo lost a whole socket-probe loop
 * that way. Written without literal comment delimiters on purpose.
 */
function stripComments(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().startsWith("//")) return "";
      const idx = line.indexOf("//");
      // The `://` guard keeps URL literals such as "https://..." intact.
      return idx === -1 || line.slice(0, idx).includes(":") ? line : line.slice(0, idx);
    })
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

const code = stripComments(actions);

/** The body of one exported async function, so assertions cannot leak across. */
function functionBody(source: string, name: string, until: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const end = source.indexOf(until, start);
  return source.slice(start, end === -1 ? undefined : end);
}

const changePasswordBody = functionBody(
  code,
  "changePasswordAction",
  "export async function verifyEmailAction",
);

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(ts|mts|mjs|cjs|js|tsx)$/.test(f))
    .map((f) => join(dir, f));
}

describe("change-password re-authentication (CWE-620)", () => {
  it("verifies the current password BEFORE updating the new one", () => {
    // Ordering, not mere presence. A neutered guard still leaves every token in
    // the file, so a "does it mention signInWithPassword" assertion passes whether
    // or not the check does anything.
    const verifyAt = changePasswordBody.indexOf("signInWithPassword");
    const updateAt = changePasswordBody.indexOf("updateUser");
    expect(verifyAt, "changePasswordAction never re-verifies the current password")
      .toBeGreaterThan(-1);
    expect(updateAt, "changePasswordAction never calls updateUser").toBeGreaterThan(-1);
    expect(verifyAt, "the password must be verified before it is changed")
      .toBeLessThan(updateAt);
  });

  it("returns an error instead of updating when verification fails", () => {
    const verifyAt = changePasswordBody.indexOf("signInWithPassword");
    const updateAt = changePasswordBody.indexOf("updateUser");
    const between = changePasswordBody.slice(verifyAt, updateAt);
    // A failure branch that returns before updateUser is what actually stops the
    // takeover. Without it the code verifies, ignores the result, and proceeds.
    expect(between, "the result of the re-authentication is ignored").toMatch(
      /\bif\s*\(\s*authError\s*\)/,
    );
  });

  it("does not reveal whether the current password was wrong", () => {
    // The re-auth must not echo Supabase's error, which distinguishes a bad
    // password from a disabled account and lets an attacker probe the account.
    expect(changePasswordBody).not.toMatch(/error:\s*error\.message/);
  });

  it("the Settings form collects the current password", () => {
    expect(changePasswordForm, "the change-password form has no current-password field")
      .toMatch(/currentPassword/);
    expect(changePasswordForm).toMatch(/autoComplete=["']current-password["']/);
  });

  it("the form labels it as the current password", () => {
    expect(changePasswordForm).toMatch(/current password/i);
  });
});

describe("changePasswordSchema", () => {
  it("requires a current password", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "",
      password: "LongEnough#2026",
      confirmPassword: "LongEnough#2026",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a mismatched confirmation", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "whatever",
      password: "LongEnough#2026",
      confirmPassword: "Different#2026",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a complete, matching submission", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "whatever",
      password: "LongEnough#2026",
      confirmPassword: "LongEnough#2026",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("signup error messaging", () => {
  it("does not blame the email for a rate limit", () => {
    // Measured: Supabase answers every signUp in this environment with 429 "email
    // rate limit exceeded". `signupAction` reported "Unable to create account with
    // that email.", which sends the user off to retype a perfectly good address
    // and never retry. The same misreporting already cost this project rounds of
    // investigation on the sign-in path; see lib/auth/error-messages.ts.
    const message = signupErrorMessage({ status: 429 });
    expect(message).toMatch(/too many|wait|rate/i);
    expect(message, "a rate limit must not read as a bad address").not.toMatch(
      /that email/i,
    );
  });

  it("does not blame the email for an unreachable service", () => {
    expect(signupErrorMessage({ status: 0 })).not.toMatch(/that email/i);
    expect(signupErrorMessage({ status: 503 })).not.toMatch(/that email/i);
  });

  it("still says something useful for a genuinely rejected address", () => {
    expect(signupErrorMessage({ status: 422 })).toMatch(/unable to create account/i);
  });

  it("signupAction uses the mapper instead of a hardcoded string", () => {
    const signupBody = functionBody(
      code,
      "signupAction",
      "export async function forgotPasswordAction",
    );
    expect(signupBody).toContain("signupErrorMessage(error)");
    expect(signupBody).not.toMatch(/error:\s*"Unable to create account with that email\."/);
  });
});

describe("'sign out everywhere' is reachable", () => {
  it("some UI component references logoutAllAction", () => {
    // The previous guard only asserted the function existed. It did, and it was
    // still dead code — nothing could reach it, so no user could ever revoke a
    // session on a device they had lost control of.
    const files = sourceFiles("components");
    expect(files.length, "no component sources found — the scan is vacuous")
      .toBeGreaterThan(5);
    const referencing = files.filter((f) =>
      readFileSync(f, "utf8").includes("logoutAllAction"),
    );
    expect(
      referencing.map((f) => f),
      "logoutAllAction is dead code: no component can reach the global sign-out",
    ).not.toEqual([]);
  });

  it("the account menu offers it with wording a user would look for", () => {
    const header = readFileSync(
      join(process.cwd(), "components/app/app-header.tsx"),
      "utf8",
    );
    expect(header).toMatch(/logoutAllAction/);
    expect(header, "no user-facing label for the global sign-out")
      .toMatch(/sign out everywhere|everywhere|all devices/i);
  });

  it("keeps the plain Sign out local and the global one explicit", () => {
    // The whole point of two actions is that they differ. If a future edit made
    // both local, the user would silently lose the ability to revoke other
    // devices — the original defect, reintroduced.
    expect(functionBody(code, "logoutAction", "export async function switchAccountAction"))
      .toContain('signOut({ scope: "local" })');
    expect(functionBody(code, "logoutAllAction", "$EOF$"))
      .toContain('signOut({ scope: "global" })');
  });
});