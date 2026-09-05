"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/password-field";

const initial: ActionState = { ok: false };

export function LoginForm({ nextPath = "/app" }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="rounded-[16px] border border-line bg-white p-6 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8">
      <h2 className="font-display text-2xl font-bold text-navy">Welcome back</h2>
      <p className="mt-2 text-sm text-slate">
        Sign in to access your Beepa account.
      </p>

      <form action={action} className="mt-6 space-y-4" noValidate>
        <input type="hidden" name="next" value={nextPath} />

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          />
          {state.fieldErrors?.email && (
            <p id="email-error" className="text-sm text-destructive">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            name="password"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={
              state.fieldErrors?.password ? "password-error" : undefined
            }
          />
          {state.fieldErrors?.password && (
            <p id="password-error" className="text-sm text-destructive">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        {state.error && (
          <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Need an account?{" "}
        <Link
          href="/signup"
          className="inline-flex min-h-11 items-center font-semibold text-green-strong hover:underline"
        >
          Sign up
        </Link>
      </p>
      <p className="mt-1 text-center text-sm text-slate">
        Beepa staff?{" "}
        <Link
          href="/employee/login"
          className="inline-flex min-h-11 items-center font-semibold text-green-strong hover:underline"
        >
          Employee portal
        </Link>
      </p>
    </div>
  );
}
