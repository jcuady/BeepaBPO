"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { profileUpdateSchema } from "@/lib/validation/app";
import { updateProfile } from "@/lib/profile/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type ProfileInput = z.infer<typeof profileUpdateSchema>;

export function ProfileEditForm({
  defaultValues,
}: {
  defaultValues: ProfileInput;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues,
  });

  async function onSubmit(values: ProfileInput) {
    setPending(true);
    const result = await updateProfile(values);
    setPending(false);
    if (result.ok) toast.success(result.message);
    else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to update profile.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input id="display_name" {...form.register("display_name")} />
        {errors.display_name && (
          <p className="text-sm text-destructive">{errors.display_name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" {...form.register("phone")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" {...form.register("timezone")} />
        {errors.timezone && (
          <p className="text-sm text-destructive">{errors.timezone.message}</p>
        )}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
