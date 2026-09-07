"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsTestimonialSchema } from "@/lib/validation/app";
import { createTestimonial } from "@/lib/cms/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type Input = z.infer<typeof cmsTestimonialSchema>;

const defaults: Input = {
  client_name: "",
  quote: "",
  client_title: "",
  company_name: "",
  rating: "",
};

export function TestimonialForm() {
  const [pending, setPending] = useState(false);
  const form = useForm<Input>({
    resolver: zodResolver(cmsTestimonialSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: Input) {
    setPending(true);
    const result = await createTestimonial(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create testimonial.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="testimonial-name">Client name</Label>
        <Input id="testimonial-name" {...form.register("client_name")} />
        {errors.client_name ? (
          <p className="text-sm text-destructive">{errors.client_name.message}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="testimonial-title">Title</Label>
          <Input id="testimonial-title" {...form.register("client_title")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="testimonial-company">Company</Label>
          <Input id="testimonial-company" {...form.register("company_name")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="testimonial-rating">Rating (1–5, optional)</Label>
        <Input
          id="testimonial-rating"
          inputMode="numeric"
          {...form.register("rating")}
        />
        {errors.rating ? (
          <p className="text-sm text-destructive">{errors.rating.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="testimonial-quote">Quote</Label>
        <Textarea id="testimonial-quote" rows={4} {...form.register("quote")} />
        {errors.quote ? (
          <p className="text-sm text-destructive">{errors.quote.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  );
}
