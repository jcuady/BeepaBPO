"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { IconMail } from "@tabler/icons-react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/password-field";
import { DemoLoginPicker } from "@/components/auth/demo-login-picker";
import type { DemoUser } from "@/lib/demo/users";

const initial: ActionState = { ok: false };

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
  const [email, setEmail] = useState(initialDemoEmail ?? "");
  const [password, setPassword] = useState(
    initialDemoEmail && demoPassword ? demoPassword : "",
  );

  const showDemo = Boolean(demoUsers?.length && demoPassword);

  return (
    <div className="rounded-[24px] border border-line bg-white p-6 shadow-sm sm:p-10">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-navy sm:text-3xl">
          Welcome back
        </h2>
        <p className="mt-3 text-sm text-slate">
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
              className="pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

        <div className="flex justify-end pt-1">
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
          className="w-full text-base"
          size="lg"
          disabled={pending}
        >
          {pending ? "Signing in..." : "Sign In \u2192"}
        </Button>
      </form>

      {showDemo ? (
        <DemoLoginPicker
          users={demoUsers!}
          portal="client"
          password={demoPassword!}
          onFill={(nextEmail, nextPassword) => {
            setEmail(nextEmail);
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
          Create account &rarr;
        </Link>
      </p>
    </div>
  );
}
