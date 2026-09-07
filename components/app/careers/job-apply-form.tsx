"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { jobApplicationSchema } from "@/lib/validation/app";
import { submitJobApplication } from "@/lib/recruitment/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type ApplicationInput = z.infer<typeof jobApplicationSchema>;

export function JobApplyForm({
  jobPostId,
  defaultValues,
}: {
  jobPostId: string;
  defaultValues?: Partial<ApplicationInput>;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<ApplicationInput>({
    resolver: zodResolver(jobApplicationSchema),
    defaultValues: {
      job_post_id: jobPostId,
      first_name: defaultValues?.first_name ?? "",
      last_name: defaultValues?.last_name ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      linkedin_url: "",
      notes: "",
    },
  });

  async function onSubmit(values: ApplicationInput) {
    setPending(true);
    const result = await submitJobApplication(values);
    setPending(false);
    if (result.ok) toast.success(result.message);
    else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to submit application.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...form.register("job_post_id")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" {...form.register("first_name")} />
          {errors.first_name && (
            <p className="text-sm text-destructive">{errors.first_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" {...form.register("last_name")} />
          {errors.last_name && (
            <p className="text-sm text-destructive">{errors.last_name.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...form.register("email")} />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" {...form.register("phone")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="linkedin_url">LinkedIn URL</Label>
        <Input id="linkedin_url" {...form.register("linkedin_url")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Cover note</Label>
        <Textarea id="notes" rows={4} {...form.register("notes")} />
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
