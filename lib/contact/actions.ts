"use server";

import { headers } from "next/headers";
import { contactSchema } from "@/lib/validation/auth";
import { consoleLeadSink, rateLimit } from "@/lib/leads";
import type { ActionState } from "@/lib/auth/actions";

export async function contactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    company: String(formData.get("company") ?? ""),
    message: String(formData.get("message") ?? ""),
    website: String(formData.get("website") ?? ""),
  };

  if (raw.website) {
    return { ok: true, message: "Thanks - your request has been received." };
  }

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "Please check the form and try again.",
    };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`contact:${ip}`)) {
    return {
      ok: false,
      error: "Too many requests. Please wait a minute and try again.",
    };
  }

  await consoleLeadSink.submit({
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company,
    message: parsed.data.message,
    createdAt: new Date().toISOString(),
  });

  return {
    ok: true,
    message:
      "Thanks - your request has been received. Our team will follow up shortly.",
  };
}
