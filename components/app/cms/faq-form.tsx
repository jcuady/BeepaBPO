"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cmsFaqSchema } from "@/lib/validation/app";
import { createFaq, updateFaq } from "@/lib/cms/actions";
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

export function FaqForm({
  id,
  initial,
  onSaved,
  idPrefix = "faq",
}: {
  id?: string;
  initial?: Partial<FaqInput>;
  onSaved?: () => void;
  idPrefix?: string;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<FaqInput>({
    resolver: zodResolver(cmsFaqSchema),
    defaultValues: { ...defaults, ...initial },
  });

  async function onSubmit(values: FaqInput) {
    setPending(true);
    const result = id
      ? await updateFaq({ ...values, id })
      : await createFaq(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      if (id) onSaved?.();
      else form.reset(defaults);
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to save FAQ.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-question`}>Question</Label>
        <Input id={`${idPrefix}-question`} {...form.register("question")} />
        {errors.question ? (
          <p className="text-sm text-destructive">{errors.question.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Input
          id={`${idPrefix}-category`}
          placeholder="general"
          {...form.register("category")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-answer`}>Answer</Label>
        <Textarea
          id={`${idPrefix}-answer`}
          rows={5}
          {...form.register("answer")}
        />
        {errors.answer ? (
          <p className="text-sm text-destructive">{errors.answer.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : id ? "Save changes" : "Save draft"}
      </Button>
    </form>
  );
}
