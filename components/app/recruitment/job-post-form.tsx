"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { jobPostSchema } from "@/lib/validation/app";
import { createJobPost, updateJobPost } from "@/lib/recruitment/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type JobPostInput = z.infer<typeof jobPostSchema>;

const defaults: JobPostInput = {
  status: "draft",
  location_type: "hybrid",
  employment_type: "regular",
  title: "",
  slug: "",
  description: "",
  location_text: "",
  salary_display: "",
};

export function JobPostForm({
  jobId,
  initialValues,
}: {
  jobId?: string;
  initialValues?: JobPostInput;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const isEdit = Boolean(jobId);
  const form = useForm<JobPostInput>({
    resolver: zodResolver(jobPostSchema),
    defaultValues: initialValues ?? defaults,
  });

  async function onSubmit(values: JobPostInput) {
    setPending(true);
    const result = isEdit
      ? await updateJobPost({ ...values, id: jobId })
      : await createJobPost(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      if (isEdit) {
        router.refresh();
      } else {
        form.reset(defaults);
      }
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to save job post.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register("title")} />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          placeholder="senior-engineer"
          {...form.register("slug")}
        />
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} {...form.register("description")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location_text">Location</Label>
          <Input id="location_text" {...form.register("location_text")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salary_display">Salary display</Label>
          <Input id="salary_display" {...form.register("salary_display")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm"
            {...form.register("status")}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location_type">Location type</Label>
          <select
            id="location_type"
            className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm"
            {...form.register("location_type")}
          >
            <option value="remote">Remote</option>
            <option value="onsite">Onsite</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employment_type">Employment type</Label>
          <select
            id="employment_type"
            className="flex min-h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm"
            {...form.register("employment_type")}
          >
            <option value="regular">Regular</option>
            <option value="probationary">Probationary</option>
            <option value="contractual">Contractual</option>
            <option value="part_time">Part time</option>
            <option value="intern">Intern</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending
            ? "Saving…"
            : isEdit
              ? "Update job post"
              : "Save job post"}
        </Button>
        {!isEdit ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => form.reset(defaults)}
          >
            Reset
          </Button>
        ) : null}
      </div>
    </form>
  );
}
