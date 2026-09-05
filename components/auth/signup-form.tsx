"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/password-field";

const initial: ActionState = { ok: false };

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initial);

  if (state.ok) {
    return (
      <div className="rounded-[16px] border border-line bg-white p-6 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8">
        <h2 className="font-display text-2xl font-bold text-navy">
          Check your email
        </h2>
        <p className="mt-3 text-base text-slate">{state.message}</p>
        {state.verifyToken && (
          <p className="mt-4 rounded-[8px] bg-mist p-3 text-sm text-navy">
            Dev verification link:{" "}
            <Link
              className="font-semibold text-green-strong underline"
              href={`/verify-email?token=${state.verifyToken}`}
            >
              Verify email
            </Link>
          </p>
        )}
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center font-display text-sm font-semibold text-green-strong hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-line bg-white p-6 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8">
      <h2 className="font-display text-2xl font-bold text-navy">
        Create your account
      </h2>
      <p className="mt-2 text-sm text-slate">
        Public accounts start with basic access. Privileged roles are assigned
        by invitation only.
      </p>

      <form action={action} className="mt-6 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" autoComplete="given-name" required />
            {state.fieldErrors?.firstName && (
              <p className="text-sm text-destructive">{state.fieldErrors.firstName[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" autoComplete="family-name" required />
            {state.fieldErrors?.lastName && (
              <p className="text-sm text-destructive">{state.fieldErrors.lastName[0]}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          {state.fieldErrors?.email && (
            <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company (optional)</Label>
          <Input id="company" name="company" autoComplete="organization" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordField id="password" name="password" autoComplete="new-password" />
          {state.fieldErrors?.password && (
            <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
          />
          {state.fieldErrors?.confirmPassword && (
            <p className="text-sm text-destructive">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>

        <div className="flex items-start gap-3">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            required
            className="mt-0 size-11 shrink-0 cursor-pointer rounded-[8px] border-line accent-green-strong focus-visible:ring-2 focus-visible:ring-green"
          />
          <Label htmlFor="acceptTerms" className="pt-2.5 text-sm font-normal leading-snug text-slate">
            I agree to the{" "}
            <Link
              href="/terms"
              className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-green-strong hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="inline-flex min-h-11 min-w-11 items-center justify-center px-1 font-semibold text-green-strong hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </Label>
        </div>
        {state.fieldErrors?.acceptTerms && (
          <p className="text-sm text-destructive">{state.fieldErrors.acceptTerms[0]}</p>
        )}

        {state.error && (
          <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Already have an account?{" "}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-semibold text-green-strong hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
