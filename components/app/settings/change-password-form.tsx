"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ActionState,
} from "@/lib/auth/actions";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: ActionState = { ok: false };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="settings-password">New password</Label>
        <PasswordField
          id="settings-password"
          name="password"
          autoComplete="new-password"
        />
        {state.fieldErrors?.password ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-confirm">Confirm password</Label>
        <PasswordField
          id="settings-confirm"
          name="confirmPassword"
          autoComplete="new-password"
        />
        {state.fieldErrors?.confirmPassword ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.confirmPassword[0]}
          </p>
        ) : null}
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="text-sm text-green-strong" role="status">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
