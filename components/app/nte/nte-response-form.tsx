"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { nteResponseSchema } from "@/lib/validation/app";
import { submitNteResponse } from "@/lib/hr/nte-actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type Input = z.infer<typeof nteResponseSchema>;

export function NteResponseForm({ nteCaseId }: { nteCaseId: string }) {
  const [pending, setPending] = useState(false);
  const form = useForm<Input>({
    resolver: zodResolver(nteResponseSchema),
    defaultValues: { nte_case_id: nteCaseId, response_text: "" },
  });

  async function onSubmit(values: Input) {
    setPending(true);
    const result = await submitNteResponse(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset({ nte_case_id: nteCaseId, response_text: "" });
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to submit response.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`nte-response-${nteCaseId}`}>Your response</Label>
        <Textarea
          id={`nte-response-${nteCaseId}`}
          rows={4}
          {...form.register("response_text")}
        />
        {errors.response_text ? (
          <p className="text-sm text-destructive">
            {errors.response_text.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Submitting…" : "Submit response"}
      </Button>
    </form>
  );
}
