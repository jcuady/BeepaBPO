"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction, type ActionState } from "@/lib/auth/actions";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: ActionState = { ok: false };

export function ResetPasswordForm({
  token,
  hasRecoverySession = false,
}: {
  token: string;
  hasRecoverySession?: boolean;
}) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);

  if (state.ok) {
    return (
      <div className="rounded-[16px] border border-line bg-white p-6 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8">
        <h2 className="font-display text-2xl font-bold text-navy">Password updated</h2>
        <p className="mt-3 text-base text-slate">{state.message}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center font-display text-sm font-semibold text-green-strong hover:underline"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!token && !hasRecoverySession) {
    return (
      <div className="rounded-[16px] border border-line bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold text-navy">Invalid link</h2>
        <p className="mt-3 text-slate">
          This reset link is missing or incomplete. Request a new one.
        </p>
        <Link href="/forgot-password" className="mt-6 inline-flex font-semibold text-green-strong hover:underline">
          Request reset
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-line bg-white p-6 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8">
      <h2 className="font-display text-2xl font-bold text-navy">Choose a new password</h2>
      <form action={action} className="mt-6 space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
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
        {state.error && (
          <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
