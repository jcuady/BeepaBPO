"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { adminInviteSchema } from "@/lib/validation/app";
import { inviteInternalUser } from "@/lib/admin/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type InviteInput = z.infer<typeof adminInviteSchema>;

const ROLE_OPTIONS: { value: InviteInput["role_code"]; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "hr", label: "HR" },
  { value: "recruiter", label: "Recruiter" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations" },
  { value: "account_manager", label: "Account manager" },
  { value: "team_lead", label: "Team lead" },
  { value: "finance", label: "Finance" },
];

const defaults: InviteInput = {
  email: "",
  first_name: "",
  last_name: "",
  role_code: "employee",
};

export function AdminInviteForm() {
  const [pending, setPending] = useState(false);
  const form = useForm<InviteInput>({
    resolver: zodResolver(adminInviteSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: InviteInput) {
    setPending(true);
    const result = await inviteInternalUser(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to invite user.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-first-name">First name</Label>
          <Input
            id="invite-first-name"
            className="min-h-11"
            autoComplete="given-name"
            {...form.register("first_name")}
          />
          {errors.first_name ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.first_name.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-last-name">Last name</Label>
          <Input
            id="invite-last-name"
            className="min-h-11"
            autoComplete="family-name"
            {...form.register("last_name")}
          />
          {errors.last_name ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.last_name.message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Work email</Label>
        <Input
          id="invite-email"
          type="email"
          className="min-h-11"
          autoComplete="email"
          placeholder="name@beepabpo.com"
          {...form.register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
          {...form.register("role_code")}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.role_code ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.role_code.message}
          </p>
        ) : null}
      </div>
      <p className="text-xs text-slate">
        Sends a Supabase invite email and grants an internal Beepa membership.
        Owner and Super Admin are not available here.
      </p>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Sending invite…" : "Send invite"}
      </Button>
    </form>
  );
}
