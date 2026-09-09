"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  IconArrowRight,
  IconBuilding,
  IconMail,
  IconUser,
} from "@tabler/icons-react";
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
      <div className="rounded-[24px] border border-white/80 bg-white p-6 shadow-[0_20px_50px_-28px_rgb(31_32_88/0.35)] ring-1 ring-line/70 sm:p-9">
        <h2 className="text-center font-display text-2xl font-bold text-navy sm:text-3xl">
          Check your email
        </h2>
        <p className="mt-3 text-center text-base text-slate">{state.message}</p>
        {state.verifyToken && (
          <p className="mt-4 rounded-[8px] bg-mist p-3 text-center text-sm text-navy">
            Dev verification link:{" "}
            <Link
              className="font-semibold text-green-strong underline"
              href={`/verify-email?token=${state.verifyToken}`}
            >
              Verify email
            </Link>
          </p>
        )}
        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-display text-sm font-semibold text-green-strong hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/80 bg-white p-6 shadow-[0_20px_50px_-28px_rgb(31_32_88/0.35)] ring-1 ring-line/70 sm:p-9">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          Create your account
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          Join Beepa and start building what&apos;s next, together.
        </p>
      </div>

      <form action={action} className="mt-8 space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate">
              <IconUser stroke={1.5} className="size-5" />
            </div>
            <Input
              id="fullName"
              name="fullName"
              placeholder="Juan Dela Cruz"
              autoComplete="name"
              required
              className="min-h-11 pl-10"
            />
          </div>
          {state.fieldErrors?.fullName && (
            <p className="text-sm text-destructive">
              {state.fieldErrors.fullName[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate">
              <IconMail stroke={1.5} className="size-5" />
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
              className="min-h-11 pl-10"
            />
          </div>
          {state.fieldErrors?.email && (
            <p className="text-sm text-destructive">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company name</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate">
              <IconBuilding stroke={1.5} className="size-5" />
            </div>
            <Input
              id="company"
              name="company"
              placeholder="Your company name"
              autoComplete="organization"
              className="min-h-11 pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordField
            id="password"
            name="password"
            placeholder="Create a password"
            autoComplete="new-password"
          />
          {state.fieldErrors?.password && (
            <p className="text-sm text-destructive">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm your password"
            autoComplete="new-password"
          />
          {state.fieldErrors?.confirmPassword && (
            <p className="text-sm text-destructive">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>

        <div className="flex items-start gap-3 pt-1">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            required
            className="mt-1 size-5 shrink-0 cursor-pointer rounded-[6px] border-line accent-green-strong focus-visible:ring-2 focus-visible:ring-green-strong"
          />
          <Label
            htmlFor="acceptTerms"
            className="text-sm font-normal leading-snug text-slate"
          >
            I agree to the{" "}
            <Link
              href="/terms"
              className="font-semibold text-green-strong hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-semibold text-green-strong hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </Label>
        </div>
        {state.fieldErrors?.acceptTerms && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.acceptTerms[0]}
          </p>
        )}

        {state.error && (
          <p
            className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          className="group w-full gap-2 text-base active:scale-[0.98]"
          size="lg"
          disabled={pending}
        >
          {pending ? "Creating account..." : "Create account"}
          {!pending ? (
            <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
              <IconArrowRight stroke={2} className="size-3.5" />
            </span>
          ) : null}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-slate">
        Email and password only. Social login is not enabled yet.
      </p>

      <p className="mt-6 text-center text-sm text-slate">
        Already have an account?{" "}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-semibold text-green-strong hover:underline"
        >
          Sign in →
        </Link>
      </p>
    </div>
  );
}
