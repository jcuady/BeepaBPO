"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { IconArrowRight, IconMail } from "@tabler/icons-react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/password-field";
import { DemoLoginPicker } from "@/components/auth/demo-login-picker";
import type { DemoUser } from "@/lib/demo/users";

const initial: ActionState = { ok: false };
const REMEMBER_KEY = "beepa.login.rememberEmail";

function subscribeRemember() {
  return () => {};
}

function getRememberedEmail() {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistRemember(email: string, on: boolean) {
  try {
    if (on && email) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

type LoginFormProps = {
  nextPath?: string;
  demoUsers?: readonly DemoUser[];
  demoPassword?: string;
  initialDemoEmail?: string;
};

export function LoginForm({
  nextPath = "/app",
  demoUsers,
  demoPassword,
  initialDemoEmail,
}: LoginFormProps) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const savedEmail = useSyncExternalStore(
    subscribeRemember,
    getRememberedEmail,
    () => "",
  );
  const [emailOverride, setEmailOverride] = useState<string | null>(
    initialDemoEmail ?? null,
  );
  const email = emailOverride ?? savedEmail;
  const [password, setPassword] = useState(
    initialDemoEmail && demoPassword ? demoPassword : "",
  );
  const [rememberOverride, setRememberOverride] = useState<boolean | null>(
    null,
  );
  const remember = rememberOverride ?? Boolean(savedEmail);

  const showDemo = Boolean(demoUsers?.length && demoPassword);

  return (
    <div className="rounded-[24px] border border-white/80 bg-white p-6 shadow-[0_20px_50px_-28px_rgb(31_32_88/0.35)] ring-1 ring-line/70 sm:p-9">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          Welcome back
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          Sign in to your Beepa account to continue building what&apos;s next,
          together.
        </p>
      </div>

      <form action={action} className="mt-8 space-y-5" noValidate>
        <input type="hidden" name="next" value={nextPath} />

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
              value={email}
              onChange={(e) => setEmailOverride(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.email)}
              aria-describedby={
                state.fieldErrors?.email ? "email-error" : undefined
              }
            />
          </div>
          {state.fieldErrors?.email && (
            <p id="email-error" className="text-sm text-destructive">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordField
            id="password"
            name="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <div className="flex items-center justify-between gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-navy">
            <Checkbox
              checked={remember}
              onCheckedChange={(checked) => {
                const on = checked === true;
                setRememberOverride(on);
                persistRemember(email, on);
              }}
              aria-label="Remember me"
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm font-medium text-green-strong hover:underline"
          >
            Forgot password?
          </Link>
        </div>

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
          onClick={() => persistRemember(email, remember)}
        >
          {pending ? "Signing in..." : "Sign In"}
          {!pending ? (
            <span className="flex size-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
              <IconArrowRight stroke={2} className="size-3.5" />
            </span>
          ) : null}
        </Button>
      </form>

      {/* OAuth deferred — email/password only (no decoy Google CTA). */}
      <p className="mt-5 text-center text-xs text-slate">
        Email and password sign-in. Social login is not enabled yet.
      </p>

      {showDemo ? (
        <DemoLoginPicker
          users={demoUsers!}
          portal="client"
          password={demoPassword!}
          onFill={(nextEmail, nextPassword) => {
            setEmailOverride(nextEmail);
            setPassword(nextPassword);
          }}
        />
      ) : null}

      <p className="mt-8 text-center text-sm text-slate">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="inline-flex min-h-11 items-center font-semibold text-green-strong hover:underline"
        >
          Create account →
        </Link>
      </p>
    </div>
  );
}
