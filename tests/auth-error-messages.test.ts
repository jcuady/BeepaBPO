import { describe, expect, it } from "vitest";
import {
  authCallbackErrorMessage,
  authErrorMessage,
  inviteErrorMessage,
} from "@/lib/auth/error-messages";

/**
 * A wrong password and a rate-limited request are different problems with
 * different fixes. Reporting both as "Invalid email or password." sends the
 * user to reset a password that works.
 *
 * These assertions are behavioural, not a source scan, because the mapping is
 * the whole point: it is the copy the user reads when Supabase says something
 * other than "bad credentials".
 */
describe("authErrorMessage", () => {
  it("tells a rate-limited user to wait, not to reset their password", () => {
    const message = authErrorMessage({ status: 429 });
    expect(message).toMatch(/too many|wait/i);
    expect(message).not.toMatch(/invalid|incorrect|wrong password/i);
  });

  it("does not blame the password when the service is unreachable", () => {
    // supabase-js reports a network failure as status 0.
    const network = authErrorMessage({ status: 0 });
    expect(network).toMatch(/couldn't reach|try again/i);
    expect(network).not.toMatch(/invalid|incorrect|wrong password/i);
  });

  it("does not blame the password when the auth service is broken", () => {
    for (const status of [500, 502, 503]) {
      expect(authErrorMessage({ status })).not.toMatch(/invalid|incorrect/i);
    }
  });

  it("still reports genuinely bad credentials as bad credentials", () => {
    // 400 is what GoTrue returns for invalid_grant. The distinction must not
    // be so eager that the real case stops being reported.
    expect(authErrorMessage({ status: 400 })).toMatch(/invalid email or password/i);
  });

  it("handles a missing error object without crashing", () => {
    expect(() => authErrorMessage(null)).not.toThrow();
    expect(authErrorMessage(null)).toBeTruthy();
    expect(authErrorMessage({})).toBeTruthy();
  });

  it("maps every documented case to a non-empty, distinct message", () => {
    const cases = [429, 0, 500, 503, 400];
    const messages = cases.map((status) => authErrorMessage({ status }));
    for (const m of messages) expect(m.trim().length).toBeGreaterThan(10);
    // Rate limiting and bad credentials must not read identically.
    expect(messages[0]).not.toBe(messages[4]);
    expect(messages[1]).not.toBe(messages[4]);
  });
});

/**
 * The invite family is the fourth mapper over the same three statuses, and it was
 * the only one of the four that returned the provider's raw string.
 *
 * `lib/auth/error-messages.ts` says in its own header comment that the failure
 * mode it exists to prevent is "the next mapper added inventing a fourth reading
 * of a status that three others already agree on". This block is that mapper.
 *
 * The defect was not theoretical. Measured in this environment, an org admin
 * inviting a client user was shown a toast reading exactly:
 *
 *     email rate limit exceeded
 *
 * That is GoTrue's internal vocabulary for an HTTP 429, rendered verbatim to a
 * business user, with no instruction and no way to tell that retyping the
 * address will not help. The three sibling mappers already translate that exact
 * status into copy a user can act on.
 */
describe("inviteErrorMessage", () => {
  it("never echoes the provider's raw message", () => {
    // The exact error object `inviteUserByEmail` produced when the quota closed.
    const raw = {
      status: 429,
      message: "email rate limit exceeded",
    };
    const message = inviteErrorMessage(raw);
    expect(message).not.toMatch(/rate limit/i);
    expect(message).not.toContain(raw.message);
    // And it must not fall back to the provider text for any other status either.
    for (const status of [0, 400, 500, 503]) {
      const out = inviteErrorMessage({ status, message: "email rate limit exceeded" });
      expect(out).not.toContain("email rate limit exceeded");
    }
  });

  it("tells a rate-limited user to wait rather than to fix their input", () => {
    const message = inviteErrorMessage({ status: 429 });
    expect(message).toMatch(/too many|wait/i);
    // A rate limit is not a verdict on the address or the organization.
    expect(message).not.toMatch(/invalid address|not configured|already registered/i);
  });

  it("does not blame the address when the service is unreachable", () => {
    // supabase-js reports a network failure as status 0.
    const network = inviteErrorMessage({ status: 0 });
    expect(network).toMatch(/couldn't reach|try again/i);
    expect(network).not.toMatch(/invalid|already/i);
  });

  it("does not blame the address when the auth service is broken", () => {
    for (const status of [500, 502, 503]) {
      expect(inviteErrorMessage({ status })).not.toMatch(/invalid|already registered/i);
    }
  });

  it("keeps the rejected branch free of an account-existence oracle", () => {
    // `inviteUserByEmail` answers "already been registered" for a taken address,
    // and `inviteOrResolveAuthUser` intercepts that string BEFORE it reaches this
    // mapper. So nothing in here may describe the account as existing or not:
    // a staff member who could read it off the error would gain an oracle the
    // staff-only surface does not otherwise need.
    const rejected = inviteErrorMessage({ status: 400 });
    expect(rejected).not.toMatch(/already|exists|registered|taken/i);
    expect(rejected).toMatch(/try again/i);
  });

  it("handles a missing error object without crashing", () => {
    expect(() => inviteErrorMessage(null)).not.toThrow();
    expect(inviteErrorMessage(null)).toBeTruthy();
    expect(inviteErrorMessage({})).toBeTruthy();
  });

  it("agrees with its siblings on what each status means", () => {
    // The drift this guards against is two mappers disagreeing about a status.
    // Invite copy differs from sign-in copy by design, so compare the decision,
    // not the string: 429 must read as "wait", and 0/5xx must read as
    // "unreachable", in both families.
    expect(inviteErrorMessage({ status: 429 })).toMatch(/too many/i);
    expect(authErrorMessage({ status: 429 })).toMatch(/too many/i);
    for (const status of [0, 500, 503]) {
      expect(inviteErrorMessage({ status })).toMatch(/couldn't reach/i);
      expect(authErrorMessage({ status })).toMatch(/couldn't reach/i);
    }
  });
});

/**
 * The notice `/auth/callback` sends a person to when a signup or reset link
 * could not be completed.
 *
 * This parameter had no reader at all. `auth_callback` appeared exactly once in
 * the codebase -- on the redirect that produced it -- so every expired or
 * already-used link dropped the user on a plain login form saying nothing.
 *
 * Asserted behaviourally, because the mapping is the whole point: the copy is
 * what the user reads after a link dies.
 */
describe("authCallbackErrorMessage", () => {
  it("explains a dead link", () => {
    const message = authCallbackErrorMessage("auth_callback");
    expect(message).toBeTruthy();
    expect(message).toMatch(/invalid|expired/i);
  });

  it("offers a way forward rather than only reporting failure", () => {
    // A bare "your link expired" tells the user what happened and nothing about
    // what to do, which is what made the old silent page so costly: the obvious
    // reading was "nothing happened", so they request the same email again.
    expect(authCallbackErrorMessage("auth_callback")).toMatch(/sign in|request/i);
  });

  it("returns null for anything it does not recognise", () => {
    // The parameter is attacker-controlled. Reflecting it would turn a redirect
    // parameter into an injection surface, so an unknown code must render nothing.
    expect(authCallbackErrorMessage("something_else")).toBeNull();
    expect(authCallbackErrorMessage("CANARY_echoed_error_value")).toBeNull();
    expect(authCallbackErrorMessage("<script>alert(1)</script>")).toBeNull();
  });

  it("renders nothing when there is no parameter at all", () => {
    // Otherwise every ordinary sign-in would show a red banner.
    expect(authCallbackErrorMessage(null)).toBeNull();
    expect(authCallbackErrorMessage(undefined)).toBeNull();
    expect(authCallbackErrorMessage("")).toBeNull();
  });

  it("keeps the account-existence oracle out, like its siblings", () => {
    // Same rule as every other mapper in this file: a link that fails must not
    // become a way to learn whether an account exists.
    const message = authCallbackErrorMessage("auth_callback") ?? "";
    expect(message).not.toMatch(/already (registered|exists)|no account|not found/i);
  });
});