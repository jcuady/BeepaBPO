"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { getEnv } from "@/lib/env";
import { safeNext } from "@/lib/auth/safe-next";
import { authErrorMessage } from "@/lib/auth/error-messages";
import {
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
  verifyToken?: string;
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
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: authCallbackUrl("/app"),
      data: {
        full_name: parsed.data.fullName,
        first_name: firstName,
        last_name: lastName,
        display_name: parsed.data.fullName,
        company: parsed.data.company ?? null,
      },
    },
  });

  if (error) {
    return {
      ok: false,
      error: "Unable to create account with that email.",
    };
  }

  if (data.user?.id) {
    await assignApplicantMembership(data.user.id);
  }

  return {
    ok: true,
    message:
      "Account created. Check your email to verify before signing in.",
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
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: authCallbackUrl("/reset-password"),
  });

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
  const parsed = resetPasswordSchema.safeParse(raw);
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

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      ok: false,
      error: error.message || "Unable to update password.",
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
