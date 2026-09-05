"use server";

import { redirect } from "next/navigation";
import { getAuthProvider } from "@/lib/auth/provider";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/auth/session";
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

  const result = await getAuthProvider().signIn(parsed.data);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await setSessionCookie({
    sub: result.user.id,
    email: result.user.email,
    name: `${result.user.firstName} ${result.user.lastName}`,
    verified: result.user.verified,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  const next = (formData.get("next") as string) || "/app";
  redirect(next.startsWith("/") ? next : "/app");
}

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

  const result = await getAuthProvider().signIn(parsed.data);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await setSessionCookie({
    sub: result.user.id,
    email: result.user.email,
    name: `${result.user.firstName} ${result.user.lastName}`,
    verified: result.user.verified,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  const next = (formData.get("next") as string) || "/app";
  redirect(next.startsWith("/") ? next : "/app");
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

  const result = await getAuthProvider().signUp(parsed.data);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    message:
      "Account created. Check your email to verify before signing in. (Dev: use the verification link shown below.)",
    verifyToken: result.verifyToken,
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

  const result = await getAuthProvider().requestPasswordReset(parsed.data.email);
  return {
    ok: true,
    message:
      "If an account exists for that email, we sent reset instructions.",
    // Dev-only token surface for mock provider
    verifyToken: result.token,
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

  const result = await getAuthProvider().resetPassword(
    parsed.data.token,
    parsed.data.password,
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    message: "Password updated. You can sign in with your new password.",
  };
}

export async function verifyEmailAction(token: string): Promise<ActionState> {
  const result = await getAuthProvider().verifyEmail(token);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    message: "Email verified. You can sign in now.",
  };
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/");
}
