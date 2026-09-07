"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsFaqSchema } from "@/lib/validation/app";
import { createFaq } from "@/lib/cms/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type FaqInput = z.infer<typeof cmsFaqSchema>;

const defaults: FaqInput = {
  question: "",
  answer: "",
  category: "general",
};

export function FaqForm() {
  const [pending, setPending] = useState(false);
  const form = useForm<FaqInput>({
    resolver: zodResolver(cmsFaqSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: FaqInput) {
    setPending(true);
    const result = await createFaq(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to create FAQ.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="faq-question">Question</Label>
        <Input id="faq-question" {...form.register("question")} />
        {errors.question ? (
          <p className="text-sm text-destructive">{errors.question.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="faq-category">Category</Label>
        <Input
          id="faq-category"
          placeholder="general"
          {...form.register("category")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="faq-answer">Answer</Label>
        <Textarea id="faq-answer" rows={5} {...form.register("answer")} />
        {errors.answer ? (
          <p className="text-sm text-destructive">{errors.answer.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  );
}
