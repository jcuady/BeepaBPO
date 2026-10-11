import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "@/lib/validation/auth";
import {
  passwordResetErrorMessage,
  signupErrorMessage,
  signupSuccessMessage,
} from "@/lib/auth/error-messages";

/**
 * Four security defects in the auth layer, all found by driving the real UI.
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
 *
 * 3. Signup confirmed an account it never created.
 *    Supabase deliberately does not disclose whether an address is registered.
 *    Measured here: `signUp` against an address that already has an account
 *    returns no error and a user id belonging to no real auth user, and
 *    `signupAction` reported "Account created" off that response anyway.
 *
 * 4. `forgotPasswordAction` discarded its error.
 *    The result of `resetPasswordForEmail` was awaited and thrown away, so a
 *    429 and a successful send were reported identically — both as "we sent reset
 *    instructions".
 *
 * 3 and 4 are the same defect wearing different clothes: a message that cannot
 * distinguish the two causes sends every investigation down the wrong path. See
 * lib/auth/error-messages.ts, which is where that rule is written down.
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

describe("signup must not confirm an account it did not create", () => {
  const signupBody = functionBody(
    code,
    "signupAction",
    "export async function forgotPasswordAction",
  );

  it("never tells the user an account was created", () => {
    // Measured: signUp against an address that already has an account returns no
    // error at all, plus a user id belonging to no real auth user. The old copy
    // read "Account created" straight off that response, so a prospective user
    // with a taken address was told their account existed — and, worse, that
    // their address was free. Supabase does not disclose this and the
    // non-disclosure is the product's stance, so the copy is the only place this
    // lie can be taken back.
    expect(signupSuccessMessage()).not.toMatch(/account created/i);
    expect(signupBody, "signupAction still reports a created account").not.toMatch(
      /Account created/,
    );
  });

  it("says the same thing whether the address was free or already taken", () => {
    // The oracle test. This has to hold without anyone re-reading the copy, so it
    // is pinned two ways: the mapper takes no outcome to branch on (arity 0 — no
    // status, user object or flag exists for a later edit to feed it), and the
    // action returns exactly ONE success message, unswitched. Two literals, or a
    // message chosen by an `if`, would each restore the oracle even though the
    // branch would look defensible in review.
    expect(
      signupSuccessMessage.length,
      "signupSuccessMessage takes an outcome and could be branched on",
    ).toBe(0);
    expect(signupSuccessMessage()).toBe(signupSuccessMessage());

    const messages = signupBody.match(/message:\s*[^\n]+/g) ?? [];
    expect(
      messages,
      "signupAction returns more than one success message, so one of them is selected by outcome",
    ).toHaveLength(1);
    expect(messages[0]).toContain("signupSuccessMessage()");
  });

  it("names both possibilities without confirming either", () => {
    const message = signupSuccessMessage();
    expect(message, "the copy must leave both outcomes open").toMatch(/\bif\b/i);
    expect(message, "the copy must not assert that anything was created").not.toMatch(
      /account (was |is )?created|we created|your account is ready/i,
    );
    // A returning user needs somewhere to go. Without it the message only tells
    // them to wait for an email that was never sent, which is the original bug
    // with better manners.
    expect(message).toMatch(/sign in/i);
  });
});

describe("forgot-password must not report a failed send as sent", () => {
  const forgotBody = functionBody(
    code,
    "forgotPasswordAction",
    "export async function resetPasswordAction",
  );

  it("reads the error from resetPasswordForEmail", () => {
    // The bug was literally that the error could not be read: the call's result
    // was awaited and discarded. Asserting that `resetPasswordForEmail` appears
    // would pass against the broken version, so this pins the destructuring, and
    // the negative assertion catches the call being un-bound again.
    expect(forgotBody).toMatch(
      /const\s*\{\s*error\s*\}\s*=\s*await\s+supabase\.auth\.resetPasswordForEmail\(/,
    );
    expect(
      forgotBody,
      "the result of resetPasswordForEmail is awaited and thrown away again",
    ).not.toMatch(/^\s*await\s+supabase\.auth\.resetPasswordForEmail\(/m);
  });

  it("returns an error state when the send fails", () => {
    const afterCall = forgotBody.slice(forgotBody.indexOf("resetPasswordForEmail"));
    const branchAt = afterCall.indexOf("if (error)");
    expect(branchAt, "the delivery failure is never examined").toBeGreaterThan(-1);
    // `ok: false`, not `ok: true` carrying different copy: a send that did not
    // happen must not render as the confirmation panel.
    expect(
      afterCall.slice(branchAt),
      "a failed send is still reported as ok",
    ).toContain("ok: false");
    expect(afterCall).toContain("passwordResetErrorMessage(error)");
  });

  it("a rate-limited reset is not reported as sent", () => {
    // Measured: resetPasswordForEmail answered 429 on one call here and no error
    // on the next, and the action reported success both times. The user waited on
    // an inbox that had nothing in it, and rate limiting looked exactly like a
    // forgotten password.
    const message = passwordResetErrorMessage({ status: 429 });
    expect(message, "a rate limit must tell the user to wait").toMatch(
      /too many|wait/i,
    );
    expect(message, "a rate limit must not read as instructions sent").not.toMatch(
      /we sent|sent reset instructions/i,
    );
  });

  it("does not let a failure become an account-existence oracle", () => {
    // The unknown address is not an error in Supabase — the call succeeds
    // silently for one — so it must keep reaching the success copy that discloses
    // nothing. The new failure branch must not add a way to probe for accounts,
    // so no wording in the family may name an account as missing.
    expect(forgotBody).toContain(
      "If an account exists for that email, we sent reset instructions.",
    );
    const discloses = /no account|not found|does not exist|unknown address|unregistered/i;
    for (const status of [400, 422, 429, 500, 0]) {
      expect(
        passwordResetErrorMessage({ status }),
        `status ${status} discloses whether the account exists`,
      ).not.toMatch(discloses);
    }
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