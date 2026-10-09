import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth/error-messages";

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