"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsServiceSchema } from "@/lib/validation/app";
import { createService, updateService } from "@/lib/cms/actions";
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

export function ServiceForm({
  id,
  initial,
  onSaved,
  idPrefix = "service",
}: {
  id?: string;
  initial?: Partial<ServiceInput>;
  onSaved?: () => void;
  idPrefix?: string;
}) {
  const [pending, setPending] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const form = useForm<ServiceInput>({
    resolver: zodResolver(cmsServiceSchema),
    defaultValues: { ...defaults, ...initial },
  });

  async function onSubmit(values: ServiceInput) {
    setPending(true);
    const result = id
      ? await updateService({ ...values, id })
      : await createService(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      if (id) onSaved?.();
      else {
        setSlugTouched(false);
        form.reset(defaults);
      }
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to save service.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
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
        <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
        <Input
          id={`${idPrefix}-slug`}
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
        <Label htmlFor={`${idPrefix}-summary`}>Summary</Label>
        <Textarea
          id={`${idPrefix}-summary`}
          rows={2}
          {...form.register("summary")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={5}
          {...form.register("description")}
        />
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : id ? "Save changes" : "Save draft"}
      </Button>
    </form>
  );
}
