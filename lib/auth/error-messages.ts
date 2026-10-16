/**
 * Auth error copy, kept out of `lib/auth/actions.ts` so it can be unit tested.
 *
 * A `"use server"` module may only export async functions, so this pure helper
 * cannot live next to the actions that use it without becoming untestable.
 */

/**
 * The three causes any auth call can fail for, classified once for the whole
 * family below.
 *
 * This file began with one mapper and grew a second. The failure mode that
 * actually cost this project time was never a wrong branch — it was two mappers
 * drifting apart on what the same status means, so one flow read a rate limit as
 * a bad password while another read it as a bad address. Deciding here keeps
 * "429 is a rate limit, 0 and 5xx are the service, everything else is the
 * request" in a single place, so the next mapper added cannot invent a fourth
 * reading of a status that three others already agree on.
 */
type AuthFailureKind = "rate-limited" | "unreachable" | "rejected";

function authFailureKind(error: { status?: number } | null): AuthFailureKind {
  const status = error?.status ?? 0;
  if (status === 429) return "rate-limited";
  // Status 0 is a network-level failure; 5xx is the auth service itself. Neither
  // is caused by the user's input, so neither should read as a verdict on it.
  if (status === 0 || status >= 500) return "unreachable";
  return "rejected";
}

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
  const kind = authFailureKind(error);
  if (kind === "rate-limited") {
    return "Too many sign-in attempts. Wait a minute, then try again.";
  }
  if (kind === "unreachable") {
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
  const kind = authFailureKind(error);
  if (kind === "rate-limited") {
    return "Too many sign-up attempts from this network. Wait a minute, then try again.";
  }
  if (kind === "unreachable") {
    return "We couldn't reach the sign-up service. Try again in a moment.";
  }
  return "Unable to create account with that email.";
}

/**
 * What signup says when Supabase accepts the request — which it does whether or
 * not the address was already taken.
 *
 * Measured: `signUp` against an address that already has an account returns NO
 * error and a user object whose id belongs to no real auth user. Supabase does
 * not disclose whether an address is registered, and that non-disclosure is this
 * product's privacy stance, not a bug to route around. The previous copy read
 * "Account created" off that response, so someone with a taken address was told
 * their account had been created and — the part that costs them the most — that
 * their address was free. They re-submit the same address, get the same answer,
 * and conclude the form is broken.
 *
 * The fix is anti-enumeration: name both possibilities, tell the user which
 * action to take under each, and let the email confirm the rest. Nothing here
 * asserts that anything was created.
 *
 * Deliberately zero-argument. There is no status, no user object and no outcome
 * for a caller to branch on, so this copy cannot be turned into an
 * account-existence oracle by a later edit — the only way to vary it is to add a
 * parameter, which is the change that should have to argue for itself.
 */
export function signupSuccessMessage(): string {
  return "If that address wasn't already registered, we sent a verification link. If it was, sign in instead.";
}

/**
 * The password-reset sibling of `signupErrorMessage`, same three branches.
 *
 * `forgotPasswordAction` used to discard the error from `resetPasswordForEmail`
 * and report success unconditionally. Measured here: that call answered 429 on
 * one invocation and no error on the next, and the action reported success both
 * times — so a rate-limited user was told to check an inbox that had nothing in
 * it and no idea why.
 *
 * Anti-enumeration here is structural rather than a promise made in the copy. An
 * unknown address is NOT an error in Supabase: `resetPasswordForEmail` succeeds
 * silently for one, so it never reaches this mapper at all — it falls through to
 * the action's existing "If an account exists for that email" success copy.
 * Every case here is therefore a delivery or infrastructure failure, which is
 * independent of whether the account exists and so carries no information about
 * it. That is why the rejected branch is deliberately generic: a wording like
 * "no account for that address" would be an oracle, so no wording in this family
 * says any such thing.
 */
export function passwordResetErrorMessage(error: { status?: number } | null): string {
  const kind = authFailureKind(error);
  if (kind === "rate-limited") {
    return "Too many password reset requests. Wait a minute, then try again.";
  }
  if (kind === "unreachable") {
    return "We couldn't reach the service to send reset instructions. Try again in a moment.";
  }
  return "We couldn't send reset instructions. Try again in a moment.";
}

/**
 * The invite counterpart — the fourth mapper over these three statuses, and the
 * one that should not have been needed, because it is the same three branches.
 *
 * `inviteOrResolveAuthUser` returned `inviteError?.message` straight to the
 * caller, so the admin who submitted the form was shown GoTrue's own string.
 * Measured here, verbatim from the UI:
 *
 *     email rate limit exceeded
 *
 * That is the provider's internal name for HTTP 429, offered to a business user
 * with no instruction attached. The three mappers above already translate this
 * exact status into copy that says what to do, and the header comment on this
 * file names the drift this mapper creates as the failure mode worth preventing.
 *
 * `message` is accepted in the type and never read. That is deliberate and it is
 * the contract: the provider text is right there, and discarding it is the point.
 * A signature that could not accept it would let the next edit reach for it.
 */
export function inviteErrorMessage(
  error: { status?: number; message?: string } | null,
): string {
  const kind = authFailureKind(error);
  if (kind === "rate-limited") {
    return "Too many invites have been sent from this network. Wait a moment, then try again.";
  }
  if (kind === "unreachable") {
    return "We couldn't reach the invite service. Try again in a moment.";
  }
  // Deliberately says nothing about whether the address is registered. The
  // "already been registered" case is intercepted by the caller before it gets
  // here, so no wording in this branch may imply the account exists or does not.
  return "Unable to send the invite right now. Try again in a moment.";
}

/**
 * The notice `/auth/callback` sends when it could not finish a link.
 *
 * The route has redirected to `/login?error=auth_callback` since it existed, and
 * nothing ever read that parameter. `auth_callback` appeared exactly once in the
 * whole codebase — on the line that produced it. So every expired, already-used,
 * or tampered signup and reset link dropped the person on a plain login form with
 * no message at all. They had asked to reset a password, clicked the emailed
 * link, and the only feedback was silence, which reads as "nothing happened" and
 * sends them back to request the same email in a loop.
 *
 * Two rules, both asserted by `qa-exercise-auth-callback.mjs`:
 *  - returns null for an unrecognised code, so an arbitrary `?error=` is never
 *    echoed back into the page;
 *  - never claims the account exists or does not, for the same reason every other
 *    mapper in this file stays silent on that.
 */
export function authCallbackErrorMessage(code: string | null | undefined): string | null {
  if (code === "auth_callback") {
    return "This link is invalid or has expired. It may already have been used. Sign in below, or request a new one.";
  }
  return null;
}
