/**
 * Auth error copy, kept out of `lib/auth/actions.ts` so it can be unit tested.
 *
 * A `"use server"` module may only export async functions, so this pure helper
 * cannot live next to the actions that use it without becoming untestable.
 */

/**
 * Turn a Supabase auth failure into something the user can act on.
 *
 * These paths used to report every failure as "Invalid email or password." —
 * including a 429 rate limit and a network outage. Both send the user off to
 * reset a password that is perfectly fine, and both read as "my account is
 * broken".
 *
 * That misreporting was not cosmetic. When the e2e suite exhausted Supabase's
 * per-IP password-grant limit, the resulting 429 surfaced to the test as
 * "Invalid email or password.", so an infrastructure condition was investigated
 * for several rounds as a credentials bug. A message that cannot distinguish the
 * two causes sends every investigation down the wrong path.
 */
export function authErrorMessage(error: { status?: number } | null): string {
  const status = error?.status ?? 0;
  if (status === 429) {
    return "Too many sign-in attempts. Wait a minute, then try again.";
  }
  // Status 0 is a network-level failure; 5xx is the auth service itself. Neither
  // is caused by the user's password, so neither should say it is.
  if (status === 0 || status >= 500) {
    return "We couldn't reach the sign-in service. Try again in a moment.";
  }
  return "Invalid email or password.";
}

/**
 * The signup counterpart to `authErrorMessage`.
 *
 * `signupAction` reported every failure as "Unable to create account with that
 * email." — including a 429. Measured in this environment: Supabase answers
 * EVERY signUp with 429 "email rate limit exceeded", so a prospective client was
 * told their address was bad when nothing was wrong with it. They retype the same
 * address, fail the same way, and leave. Signup is the top of the funnel; a
 * transient infrastructure condition must not read as a verdict on the address.
 *
 * Same reasoning as `authErrorMessage` above, one layer up: a message that cannot
 * distinguish the causes sends every investigation down the wrong path.
 */
export function signupErrorMessage(error: { status?: number } | null): string {
  const status = error?.status ?? 0;
  if (status === 429) {
    return "Too many sign-up attempts from this network. Wait a minute, then try again.";
  }
  if (status === 0 || status >= 500) {
    return "We couldn't reach the sign-up service. Try again in a moment.";
  }
  return "Unable to create account with that email.";
}