"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsAboutSchema } from "@/lib/validation/app";
import { upsertAboutPage } from "@/lib/cms/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type AboutInput = z.infer<typeof cmsAboutSchema>;

export function AboutPageForm({
  initialHeadline,
  initialBody,
}: {
  initialHeadline?: string;
  initialBody?: string;
}) {
  const [pending, setPending] = useState(false);
  const defaults: AboutInput = {
    headline: initialHeadline ?? "Built on Purpose. Growing Together.",
    body:
      initialBody ??
      "Beepa is a people-first outsourcing partner founded in 2019.",
  };
  const form = useForm<AboutInput>({
    resolver: zodResolver(cmsAboutSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: AboutInput) {
    setPending(true);
    const result = await upsertAboutPage(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to save About page.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="about-headline">Headline</Label>
        <Input id="about-headline" {...form.register("headline")} />
        {errors.headline ? (
          <p className="text-sm text-destructive">{errors.headline.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="about-body">Body</Label>
        <Textarea id="about-body" rows={8} {...form.register("body")} />
        {errors.body ? (
          <p className="text-sm text-destructive">{errors.body.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save About page"}
      </Button>
    </form>
  );
}
