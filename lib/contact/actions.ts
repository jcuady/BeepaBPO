"use server";

import { headers } from "next/headers";
import { contactSchema } from "@/lib/validation/auth";
import { rateLimit } from "@/lib/leads";
import { createLeadFromContact } from "@/lib/crm/actions";
import type { ActionState } from "@/lib/auth/actions";

// unauthenticated: public contact form on /contact.
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
    utm_source: String(formData.get("utm_source") ?? ""),
    utm_medium: String(formData.get("utm_medium") ?? ""),
    utm_campaign: String(formData.get("utm_campaign") ?? ""),
    utm_content: String(formData.get("utm_content") ?? ""),
    utm_term: String(formData.get("utm_term") ?? ""),
    landing_page: String(formData.get("landing_page") ?? ""),
    referrer_url: String(formData.get("referrer_url") ?? ""),
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

  const { error } = await createLeadFromContact({
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company,
    message: parsed.data.message,
    utm: {
      utm_source: raw.utm_source || undefined,
      utm_medium: raw.utm_medium || undefined,
      utm_campaign: raw.utm_campaign || undefined,
      utm_content: raw.utm_content || undefined,
      utm_term: raw.utm_term || undefined,
      landing_page: raw.landing_page || undefined,
      referrer_url: raw.referrer_url || undefined,
    },
  });

  if (error) {
    return { ok: false, error: "Unable to save your request. Please try again." };
  }

  return {
    ok: true,
    message:
      "Thanks - your request has been received. Our team will follow up shortly.",
  };
}

/**
 * Public career enquiry, submitted from the landing page's career dialog.
 *
 * `submitJobApplication` cannot serve this route: it calls `resolveWorkspace()`
 * and answers "Sign in to apply for this role", because a formal application is
 * tied to a published job and an authenticated profile. The landing page's
 * career dialog is an *enquiry* — someone asking about an area before any
 * vacancy exists — so it needs its own path.
 *
 * It deliberately reuses `contactSchema`, `rateLimit` and `createLeadFromContact`
 * rather than inventing storage: an enquiry becomes a lead, exactly as a contact
 * form submission does, with the career area carried in the company field and the
 * free-text answer in the message. One lead table, one pipeline, no second
 * inbox nobody reads.
 */
export async function careerInquiryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    careerArea: String(formData.get("career_area") ?? "").slice(0, 120),
    message: String(formData.get("message") ?? ""),
    website: String(formData.get("website") ?? ""),
    landing_page: String(formData.get("landing_page") ?? ""),
  };

  // Honeypot: pretend success so bots do not learn they were caught.
  if (raw.website) {
    return { ok: true, message: "Thanks - your enquiry has been received." };
  }

  const parsed = contactSchema.safeParse({
    name: raw.name,
    email: raw.email,
    // The career area stands in for a company: an enquiry has no company.
    company: raw.careerArea || "Career enquiry",
    message: raw.message,
    website: raw.website,
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "Please check the form and try again.",
    };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`career:${ip}`)) {
    return {
      ok: false,
      error: "Too many requests. Please wait a minute and try again.",
    };
  }

  const { error } = await createLeadFromContact({
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company,
    message: `[Career enquiry — ${parsed.data.company}]\n\n${parsed.data.message}`,
    utm: {
      landing_page: raw.landing_page || undefined,
    },
  });

  if (error) {
    return {
      ok: false,
      error: "Unable to save your enquiry. Please try again.",
    };
  }

  return {
    ok: true,
    message:
      "Thanks - your enquiry has been received. We will be in touch about opportunities that match your experience.",
  };
}
