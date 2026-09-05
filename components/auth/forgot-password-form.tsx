"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = { ok: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);

  if (state.ok) {
    return (
      <div className="rounded-[16px] border border-line bg-white p-6 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8">
        <h2 className="font-display text-2xl font-bold text-navy">Check your email</h2>
        <p className="mt-3 text-base text-slate">{state.message}</p>
        {state.verifyToken && (
          <p className="mt-4 rounded-[8px] bg-mist p-3 text-sm text-navy">
            Dev reset link:{" "}
            <Link
              className="font-semibold text-green-strong underline"
              href={`/reset-password?token=${state.verifyToken}`}
            >
              Reset password
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
      <h2 className="font-display text-2xl font-bold text-navy">Reset password</h2>
      <p className="mt-2 text-sm text-slate">
        Enter your work email and we will send reset instructions if an account
        exists.
      </p>
      <form action={action} className="mt-6 space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          {state.fieldErrors?.email && (
            <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
          )}
        </div>
        {state.error && (
          <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending..." : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate">
        <Link href="/login" className="font-semibold text-green-strong hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
