"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsServiceSchema } from "@/lib/validation/app";
import { createService } from "@/lib/cms/actions";
import { slugifyTitle } from "@/lib/cms/slug";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type ServiceInput = z.infer<typeof cmsServiceSchema>;

const defaults: ServiceInput = {
  title: "",
  slug: "",
  summary: "",
  description: "",
};

export function ServiceForm() {
  const [pending, setPending] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const form = useForm<ServiceInput>({
    resolver: zodResolver(cmsServiceSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: ServiceInput) {
    setPending(true);
    const result = await createService(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      setSlugTouched(false);
      form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create service.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="service-title">Title</Label>
        <Input
          id="service-title"
          {...form.register("title", {
            onChange: (e) => {
              if (!slugTouched) {
                form.setValue("slug", slugifyTitle(e.target.value), {
                  shouldValidate: true,
                });
              }
            },
          })}
        />
        {errors.title ? (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="service-slug">Slug</Label>
        <Input
          id="service-slug"
          placeholder="customer-support"
          {...form.register("slug", {
            onChange: () => setSlugTouched(true),
          })}
        />
        {errors.slug ? (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="service-summary">Summary</Label>
        <Textarea id="service-summary" rows={2} {...form.register("summary")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="service-description">Description</Label>
        <Textarea
          id="service-description"
          rows={5}
          {...form.register("description")}
        />
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  );
}
