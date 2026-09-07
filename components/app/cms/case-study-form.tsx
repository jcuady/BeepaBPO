"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsCaseStudySchema } from "@/lib/validation/app";
import { createCaseStudy } from "@/lib/cms/actions";
import { slugifyTitle } from "@/lib/cms/slug";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type Input = z.infer<typeof cmsCaseStudySchema>;

const defaults: Input = {
  title: "",
  slug: "",
  summary: "",
  body: "",
  client_name: "",
  industry: "",
};

export function CaseStudyForm() {
  const [pending, setPending] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const form = useForm<Input>({
    resolver: zodResolver(cmsCaseStudySchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: Input) {
    setPending(true);
    const result = await createCaseStudy(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      setSlugTouched(false);
      form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create case study.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="case-title">Title</Label>
        <Input
          id="case-title"
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
        <Label htmlFor="case-slug">Slug</Label>
        <Input
          id="case-slug"
          {...form.register("slug", { onChange: () => setSlugTouched(true) })}
        />
        {errors.slug ? (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="case-client">Client</Label>
          <Input id="case-client" {...form.register("client_name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="case-industry">Industry</Label>
          <Input id="case-industry" {...form.register("industry")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="case-summary">Summary</Label>
        <Textarea id="case-summary" rows={2} {...form.register("summary")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="case-body">Body</Label>
        <Textarea id="case-body" rows={6} {...form.register("body")} />
        {errors.body ? (
          <p className="text-sm text-destructive">{errors.body.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  );
}
