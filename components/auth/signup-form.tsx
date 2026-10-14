"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  IconArrowRight,
  IconBriefcase,
  IconBuilding,
  IconMail,
  IconUser,
} from "@tabler/icons-react";
import { signupAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/password-field";
import { cn } from "@/lib/utils";

const initial: ActionState = { ok: false };

type Intent = "applicant" | "client";

/**
 * The two audiences are stated before any field is asked for, because the
 * fields differ. An applicant has no company and a work-email placeholder
 * ("you@company.com") is a small lie told to every person who came here to
 * apply for a job; a client who never gets asked which company they are
 * registering produces a lead an account manager cannot act on.
 *
 * Defaults to `applicant` because /careers is the highest-traffic entry point
 * and says "create an account to apply". Client intent is a deliberate click.
 */
const INTENTS: {
  value: Intent;
  label: string;
  hint: string;
  icon: typeof IconBriefcase;
}[] = [
  {
    value: "applicant",
    label: "Looking for work",
    hint: "Apply for an open role",
    icon: IconUser,
  },
  {
    value: "client",
    label: "Hiring talent",
    hint: "Register your company",
    icon: IconBuilding,
  },
];

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initial);
  const [intent, setIntent] = useState<Intent>("applicant");
  const isClient = intent === "client";

  if (state.ok) {
    return (
      <div className="rounded-none border border-white/80 bg-white p-6 shadow-[0_20px_50px_-28px_rgb(31_32_88/0.35)] ring-1 ring-line/70 sm:p-9">
        <h2 className="text-center font-display text-2xl font-bold text-navy sm:text-3xl">
          Check your email
        </h2>
        <p className="mt-3 text-center text-base text-slate">{state.message}</p>
        {state.verifyToken && (
          <p className="mt-4 rounded-none bg-mist p-3 text-center text-sm text-navy">
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
    <div className="rounded-none border border-white/80 bg-white p-6 shadow-[0_20px_50px_-28px_rgb(31_32_88/0.35)] ring-1 ring-line/70 sm:p-9">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          {isClient ? "Register your company" : "Create your account"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          {isClient
            ? "Tell us who you are and an account manager will set up your workspace."
            : "Create an account to apply for an open role at Beepa."}
        </p>
      </div>

      <form action={action} className="mt-8 space-y-4" noValidate>
        <fieldset>
          <legend className="text-sm font-semibold text-navy">
            What brings you here?
          </legend>
          <input type="hidden" name="intent" value={intent} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {INTENTS.map((option) => {
              const Icon = option.icon;
              const selected = intent === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  size="lg"
                  onClick={() => setIntent(option.value)}
                  aria-pressed={selected}
                  className={cn(
                    // The shared Button is a centred, non-shrinking, no-wrap
                    // control; this is a two-line stacked card, so those three
                    // defaults are overridden rather than fought with a wrapper.
                    "h-auto min-h-11 w-full flex-col items-start gap-1 whitespace-normal rounded-none border px-3 py-2.5 text-left",
                    selected
                      ? "border-green-strong bg-soft-green"
                      : "border-line bg-white [@media(hover:hover)_and_(pointer:fine)]:hover:border-navy/25",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      stroke={1.5}
                      className={cn(
                        "size-4 shrink-0",
                        selected ? "text-green-strong" : "text-slate",
                      )}
                      aria-hidden
                    />
                    <span className="text-sm font-semibold text-navy">
                      {option.label}
                    </span>
                  </span>
                  <span className="text-xs leading-snug text-slate">
                    {option.hint}
                  </span>
                </Button>
              );
            })}
          </div>
        </fieldset>

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
          <Label htmlFor="email">{isClient ? "Work email" : "Email address"}</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate">
              <IconMail stroke={1.5} className="size-5" />
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={
                isClient ? "you@company.com" : "you@email.com"
              }
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

        {/*
          Shown only for a company registration. The schema enforces it in that
          case too — hiding the field is the half that makes sense to a person,
          and the server rule is the half that actually guarantees the invariant.
        */}
        {isClient ? (
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
                required
                className="min-h-11 pl-10"
              />
            </div>
            {state.fieldErrors?.company && (
              <p className="text-sm text-destructive">
                {state.fieldErrors.company[0]}
              </p>
            )}
            <p className="text-xs leading-snug text-slate">
              We create your account now and have an account manager contact you.
              Portal access is enabled once your company is set up.
            </p>
          </div>
        ) : null}

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
            className="mt-1 size-5 shrink-0 cursor-pointer rounded-none border-line accent-green-strong focus-visible:ring-2 focus-visible:ring-green-strong"
          />
          {/* `Label` defaults to `flex items-center gap-2`, which is right for
              an icon-plus-text label but wrong here: the content is running
              prose with two links, so every text run becomes its own flex item
              and the 8px gaps render as phantom separators between words.
              `block` restores normal inline text flow. */}
          <Label
            htmlFor="acceptTerms"
            className="block text-sm font-normal leading-snug text-slate"
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
            className="rounded-none bg-red-50 px-3 py-2 text-sm text-destructive"
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
            <span className="flex size-7 items-center justify-center rounded-none bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
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
