"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ticketMessageSchema } from "@/lib/validation/app";
import { postTicketMessage } from "@/lib/tickets/actions";
import { applyFieldErrors } from "@/lib/forms/field-errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type MessageInput = z.infer<typeof ticketMessageSchema>;

export function TicketMessageForm({ ticketId }: { ticketId: string }) {
  const [pending, setPending] = useState(false);
  const form = useForm<MessageInput>({
    resolver: zodResolver(ticketMessageSchema),
    defaultValues: { ticket_id: ticketId, body: "" },
  });

  async function onSubmit(values: MessageInput) {
    setPending(true);
    const result = await postTicketMessage(values);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      form.reset({ ticket_id: ticketId, body: "" });
    } else {
      applyFieldErrors(form, result.fieldErrors);
      toast.error(result.error ?? "Unable to post message.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <input type="hidden" {...form.register("ticket_id")} />
      <div className="space-y-2">
        <Label htmlFor="body">Reply</Label>
        <Textarea id="body" rows={3} {...form.register("body")} />
        {form.formState.errors.body && (
          <p className="text-sm text-destructive">
            {form.formState.errors.body.message}
          </p>
        )}
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
