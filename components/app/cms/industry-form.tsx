"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsIndustrySchema } from "@/lib/validation/app";
import { createIndustry } from "@/lib/cms/actions";
import { slugifyTitle } from "@/lib/cms/slug";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type Input = z.infer<typeof cmsIndustrySchema>;

const defaults: Input = { name: "", slug: "", description: "" };

export function IndustryForm() {
  const [pending, setPending] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const form = useForm<Input>({
    resolver: zodResolver(cmsIndustrySchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: Input) {
    setPending(true);
    const result = await createIndustry(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      setSlugTouched(false);
      form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create industry.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="industry-name">Name</Label>
        <Input
          id="industry-name"
          {...form.register("name", {
            onChange: (e) => {
              if (!slugTouched) {
                form.setValue("slug", slugifyTitle(e.target.value), {
                  shouldValidate: true,
                });
              }
            },
          })}
        />
        {errors.name ? (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry-slug">Slug</Label>
        <Input
          id="industry-slug"
          {...form.register("slug", { onChange: () => setSlugTouched(true) })}
        />
        {errors.slug ? (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry-description">Description</Label>
        <Textarea id="industry-description" rows={3} {...form.register("description")} />
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  );
}
