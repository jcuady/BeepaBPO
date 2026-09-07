"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsBlogPostSchema } from "@/lib/validation/app";
import { createBlogPost, updateBlogPost } from "@/lib/cms/actions";
import { slugifyTitle } from "@/lib/cms/slug";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type BlogInput = z.infer<typeof cmsBlogPostSchema>;

const defaults: BlogInput = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
};

export function BlogPostForm({
  id,
  initial,
  onSaved,
  idPrefix = "blog",
}: {
  id?: string;
  initial?: Partial<BlogInput>;
  onSaved?: () => void;
  idPrefix?: string;
}) {
  const [pending, setPending] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const form = useForm<BlogInput>({
    resolver: zodResolver(cmsBlogPostSchema),
    defaultValues: { ...defaults, ...initial },
  });

  async function onSubmit(values: BlogInput) {
    setPending(true);
    const result = id
      ? await updateBlogPost({ ...values, id })
      : await createBlogPost(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      if (id) {
        onSaved?.();
      } else {
        setSlugTouched(false);
        form.reset(defaults);
      }
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to save post.");
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
          placeholder="how-we-staff-teams"
          {...form.register("slug", {
            onChange: () => setSlugTouched(true),
          })}
        />
        {errors.slug ? (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-excerpt`}>Excerpt</Label>
        <Textarea
          id={`${idPrefix}-excerpt`}
          rows={2}
          {...form.register("excerpt")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-body`}>Body</Label>
        <Textarea id={`${idPrefix}-body`} rows={8} {...form.register("body")} />
        {errors.body ? (
          <p className="text-sm text-destructive">{errors.body.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : id ? "Save changes" : "Save draft"}
      </Button>
    </form>
  );
}
