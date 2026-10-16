"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { getEnv } from "@/lib/env";
import { safeNext } from "@/lib/auth/safe-next";
import {
  authErrorMessage,
  passwordResetErrorMessage,
  signupErrorMessage,
  signupSuccessMessage,
} from "@/lib/auth/error-messages";
import {
  changePasswordSchema,
  employeeLoginSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";

export type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  // `verifyToken` used to live here, and nothing has ever set it.
  //
  // Two components read it — a "Dev verification link" on the signup confirmation
  // and a "Dev reset link" on the forgot-password confirmation — so both blocks
  // were unreachable, and neither was gated to a development environment. They
  // were one assignment away from shipping in production.
  //
  // The reset one was also a dead end even if it had fired: it pointed at
  // `/reset-password?token=…`, and `/reset-password` gates on the SESSION and
  // renders "Invalid link" for exactly that URL. So populating the field would
  // have handed a person a link telling them the link was invalid.
  //
  // Removed rather than wired up. `tests/action-state-orphans.test.ts` now fails
  // if a field is ever declared here that no action returns, so the next one of
  // these cannot be added silently.
};

function formDataToObject(formData: FormData) {
  const obj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

function authCallbackUrl(next?: string) {
  const base = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const path = next ? `/auth/callback?next=${encodeURIComponent(next)}` : "/auth/callback";
  return `${base}${path}`;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "Please check the form and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: authErrorMessage(error) };
  }

  redirect(safeNext((formData.get("next") as string) || "/app"));
}

/**
 * Turn a Supabase auth failure into something the user can act on.
 *
 * Imported rather than defined here so it can be unit tested: a `"use server"`
 * module may only export async functions, so a pure helper living in this file
 * would be permanently untestable. See `lib/auth/error-messages.ts`.
 */
export async function employeeLoginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = employeeLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const email = parsed.data.email;
  if (!z.string().email().safeParse(email).success) {
    return {
      ok: false,
      error: "Sign in with your work email. Employee ID lookup is not enabled yet.",
    };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: authErrorMessage(error) };
  }

  const userId = signInData.user?.id;
  if (!userId) {
    // `scope: "local"` is load-bearing. supabase-js defaults signOut() to
    // "global", which revokes every refresh token this user has on every
    // device — so a failed login attempt could sign the user out of a working
    // session on their phone. Discard only the session this attempt created.
    await supabase.auth.signOut({ scope: "local" });
    return { ok: false, error: "Invalid email or password." };
  }

  const { data: isInternal } = await supabase.rpc("is_internal_user");
  if (!isInternal) {
    // Same reason as above, and this path is reachable by accident: a client
    // who types their address into the employee portal lands here. With a bare
    // signOut() they were signed out of their real client portal too, on every
    // device. Refuse this attempt only.
    await supabase.auth.signOut({ scope: "local" });
    return {
      ok: false,
      error: "Use the client or applicant sign-in at /login",
    };
  }

  redirect(safeNext((formData.get("next") as string) || "/app"));
}

async function assignApplicantMembership(userId: string) {
  try {
    const admin = createAdminClient();
    const { data: role } = await admin
      .from("roles")
      .select("id")
      .eq("code", "applicant")
      .single();
    if (!role) return;

    const { data: existing } = await admin
      .from("organization_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", BEEPA_ORG_ID)
      .maybeSingle();
    if (existing) return;

    const { data: membership, error: membershipError } = await admin
      .from("organization_memberships")
      .insert({
        user_id: userId,
        organization_id: BEEPA_ORG_ID,
        membership_type: "applicant",
        status: "active",
        is_primary: true,
      })
      .select("id")
      .single();
    if (membershipError || !membership) return;

    await admin.from("membership_roles").insert({
      membership_id: membership.id,
      role_id: role.id,
    });
  } catch {
    // ponytail: applicant membership may be assigned by seed/admin later
  }
}

/**
 * A client registration becomes a CRM lead, not a portal account.
 *
 * `client_admin` and `client_viewer` carry org-scoped permissions
 * (`clients.employee_visibility`, `attendance.read`, `billing.read`), so
 * granting one requires a client organization to exist. Creating an
 * organization here would let anyone who can reach /signup mint themselves a
 * client tenant and read every employee, attendance row and invoice attached to
 * it -- a self-service privilege escalation, not a signup feature.
 *
 * So the account is created, the intent is recorded, and a lead lands in the
 * CRM for someone who already holds `clients.manage` to provision. The buyer
 * keeps the email confirmation they were promised; what they do not get is
 * portal access they were never granted.
 *
 * Uses the admin client because the user is not authenticated yet: the RLS path
 * that governs `crm_leads` writes requires a session this request does not have.
 */
async function recordClientRegistration(input: {
  email: string;
  fullName: string;
  company: string;
  userId: string | undefined;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("crm_leads").insert({
      company_name: input.company,
      contact_name: input.fullName,
      contact_email: input.email,
      source: "website_signup",
      status: "new",
      notes: input.userId
        ? `Registered through /signup (intent=client). Portal access not granted — provision a client organization and assign client_admin before this contact can sign in.`
        : "Registered through /signup (intent=client). Portal access not granted — provision a client organization and assign client_admin before this contact can sign in.",
    });
  } catch {
    // The account exists either way; a missing lead is an operational gap an
    // admin can see, not a reason to tell the registrant their signup failed
    // after their password was already set.
  }
}

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const acceptTerms = formData.get("acceptTerms") === "on";
  const parsed = signupSchema.safeParse({ ...raw, acceptTerms });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "Please check the form and try again.",
    };
  }

  const { firstName, lastName } = splitFullName(parsed.data.fullName);
  const isClient = parsed.data.intent === "client";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // A client is not sent to `/app`: they have no organization and therefore
      // no portal to enter, so the confirmation would land them on a page that
      // rejects them. They go to the page that can actually help them.
      emailRedirectTo: authCallbackUrl(isClient ? "/contact" : "/app/applicant"),
      data: {
        full_name: parsed.data.fullName,
        first_name: firstName,
        last_name: lastName,
        display_name: parsed.data.fullName,
        signup_intent: parsed.data.intent,
        company: parsed.data.company ?? null,
      },
    },
  });

  if (error) {
    return {
      ok: false,
      error: signupErrorMessage(error),
    };
  }

  if (data.user?.id) {
    // A present id is NOT evidence of a created account. Measured: for an
    // address that already has one, signUp returns no error and a user object
    // whose id belongs to no real auth user, so this insert fails its foreign key
    // to auth.users and the catch in `assignApplicantMembership` swallows it.
    // That silence is the correct outcome, not a bug to route around: there is
    // nothing to assign, and the user has been told nothing that separates the
    // two cases. Do not "fix" the swallowed error by treating a missing or
    // phantom id as a failure — that rebuilds the account-existence oracle this
    // whole branch exists not to have.
    if (isClient) {
      // Deliberately no membership. See `recordClientRegistration`.
      await recordClientRegistration({
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        company: parsed.data.company ?? "",
        userId: data.user.id,
      });
    } else {
      await assignApplicantMembership(data.user.id);
    }
  }

  return {
    ok: true,
    message: signupSuccessMessage(),
  };
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "Please enter a valid work email.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: authCallbackUrl("/reset-password"),
  });

  // The error was never destructured, so it could not be read, and success was
  // returned unconditionally. Measured: this call answered 429 on one invocation
  // and no error on the next, and the user was told reset instructions were sent
  // both times — including the time nothing was sent. They wait on an inbox that
  // has nothing in it, and rate limiting looks identical to a forgotten password.
  //
  // Error state, NOT success state with different copy. Two reasons, in order.
  // The defect is precisely that `ok: true` asserted something that did not
  // happen; only `ok: false` restores the distinction, and the form renders it
  // differently from the confirmation panel. And it is safe, which the success
  // alternative is not: every error reachable here is a delivery or rate-limit
  // failure, which is independent of whether the address is registered. An
  // unknown address is not an error in Supabase at all — the call succeeds
  // silently and falls through to the copy below — so a genuine error tells an
  // attacker nothing about existence. Returning success-with-different-copy would
  // keep the confirmation panel, which is the one thing that must not survive a
  // failed send.
  if (error) {
    return {
      ok: false,
      error: passwordResetErrorMessage(error),
    };
  }

  return {
    ok: true,
    message:
      "If an account exists for that email, we sent reset instructions.",
  };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "Please check the form and try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired.",
    };
  }

  return {
    ok: true,
    message: "Password updated. You can sign in with your new password.",
  };
}

/** Logged-in password change from Settings / Profile. */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
      error: "Please check the form and try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to change your password." };
  }

  // Re-authenticate BEFORE rotating the credential.
  //
  // This used to call `updateUser({ password })` on the strength of the session
  // alone. supabase-js treats a live session as sufficient authority to change
  // the password, so any session — including one in a borrowed, shared or
  // hijacked browser — could reset the account password and lock the real owner
  // out permanently. That is CWE-620, and the Settings form had no
  // current-password field to collect the proof even if this had wanted it.
  //
  // A phone-only account has no `email`, and the password grant cannot be used to
  // prove anything about it. Refuse rather than fall back to trusting the session,
  // which is the exact hole this check exists to close.
  if (!user.email) {
    return {
      ok: false,
      error: "We couldn't verify your current password. Contact support to change it.",
    };
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (authError) {
    // Deliberately NOT `authError` / `error.message`: Supabase's raw text
    // distinguishes a wrong password from a disabled or unknown account, which
    // would turn this form into an account-status oracle. One message for every
    // reason the check could not be satisfied.
    return {
      ok: false,
      fieldErrors: {
        currentPassword: ["That is not your current password."],
      },
      error: "Your current password is not correct.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      ok: false,
      error: "We couldn't update your password. Try again in a moment.",
    };
  }

  return { ok: true, message: "Password updated." };
}

export async function verifyEmailAction(token: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: "email",
  });
  if (error) {
    return { ok: false, error: "This verification link is invalid or has expired." };
  }
  return {
    ok: true,
    message: "Email verified. You can sign in now.",
  };
}

export async function logoutAction() {
  const supabase = await createClient();
  // Local, not global: signing out on a work laptop should end that browser's
  // session, not revoke the user's phone too. `logoutAllAction` below is the
  // deliberate way to do that.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

/** Sign out then land on login — used when switching accounts from access-denied. */
export async function switchAccountAction() {
  const supabase = await createClient();
  // Local for the same reason: switching accounts in this browser replaces the
  // session here, it does not sign the user out everywhere.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function logoutAllAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/");
}
