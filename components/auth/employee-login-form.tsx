"use client";

import Link from "next/link";
import { useActionState } from "react";
import { employeeLoginAction, type ActionState } from "@/lib/auth/actions";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = { ok: false };

export function EmployeeLoginForm({ nextPath = "/app" }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(employeeLoginAction, initial);

  return (
    <div className="rounded-[16px] border border-line bg-white p-5 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8">
      <h2 className="font-display text-xl font-bold text-navy sm:text-2xl">
        Employee &amp; Admin Access
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate">
        Sign in with your Beepa work account. Your role and permissions are
        assigned by Beepa after invitation or approval.
      </p>

      <form action={action} className="mt-6 space-y-4" noValidate>
        <input type="hidden" name="next" value={nextPath} />

        <div className="space-y-2">
          <Label htmlFor="email">Work email or Employee ID</Label>
          <Input
            id="email"
            name="email"
            type="text"
            autoComplete="username"
            inputMode="email"
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
              className="min-h-11 inline-flex items-center text-sm font-medium text-green-strong hover:underline"
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
          <p
            className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Signing in..." : "Access Portal"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Need help?{" "}
        <a
          href="mailto:it@beepabpo.com"
          className="inline-flex min-h-11 items-center font-semibold text-green-strong hover:underline"
        >
          Contact IT Support
        </a>
      </p>
      <p className="mt-1 text-center text-sm text-slate">
        Client or prospect account?{" "}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-semibold text-green-strong hover:underline"
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}
