"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { clientInviteSchema } from "@/lib/validation/app";
import { inviteClientUser } from "@/lib/clients/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type InviteInput = z.infer<typeof clientInviteSchema>;

const ROLE_OPTIONS: { value: InviteInput["role_code"]; label: string }[] = [
  { value: "client_admin", label: "Client Admin" },
  { value: "client_viewer", label: "Client Viewer" },
];

export function ClientInviteForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [pending, setPending] = useState(false);
  const defaults: InviteInput = {
    organization_id: organizations[0]?.id ?? "",
    email: "",
    first_name: "",
    last_name: "",
    role_code: "client_admin",
  };
  const form = useForm<InviteInput>({
    resolver: zodResolver(clientInviteSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: InviteInput) {
    setPending(true);
    const result = await inviteClientUser(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset({
        ...defaults,
        organization_id: values.organization_id,
      });
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to invite client user.");
    }
  }

  const errors = form.formState.errors;

  if (!organizations.length) {
    return (
      <p className="text-sm text-slate">
        Create a client organization before inviting portal users.
      </p>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client-org">Client organization</Label>
        <select
          id="client-org"
          className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
          {...form.register("organization_id")}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        {errors.organization_id ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.organization_id.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client-first-name">First name</Label>
          <Input
            id="client-first-name"
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
          <Label htmlFor="client-last-name">Last name</Label>
          <Input
            id="client-last-name"
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
        <Label htmlFor="client-email">Email</Label>
        <Input
          id="client-email"
          type="email"
          className="min-h-11"
          autoComplete="email"
          placeholder="ops@client.com"
          {...form.register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-role">Portal role</Label>
        <select
          id="client-role"
          className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm text-navy"
          {...form.register("role_code")}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-slate">
        Sends a Supabase invite and grants a client membership. They sign in at
        /login and land on the client portal.
      </p>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Sending invite…" : "Invite client user"}
      </Button>
    </form>
  );
}
