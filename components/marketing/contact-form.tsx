"use client";

import { useActionState, useSyncExternalStore } from "react";
import { contactAction } from "@/lib/contact/actions";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionState = { ok: false };

type Attribution = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  landing_page: string;
  referrer_url: string;
};

const EMPTY_ATTR: Attribution = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  utm_term: "",
  landing_page: "",
  referrer_url: "",
};

function readAttribution(): Attribution {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") ?? "",
      utm_medium: params.get("utm_medium") ?? "",
      utm_campaign: params.get("utm_campaign") ?? "",
      utm_content: params.get("utm_content") ?? "",
      utm_term: params.get("utm_term") ?? "",
      landing_page: window.location.pathname + window.location.search,
      referrer_url: document.referrer || "",
    };
  } catch {
    return EMPTY_ATTR;
  }
}

function subscribe() {
  return () => {};
}

export function ContactForm() {
  const [state, action, pending] = useActionState(contactAction, initial);
  const attr = useSyncExternalStore(subscribe, readAttribution, () => EMPTY_ATTR);

  if (state.ok) {
    return (
      <div
        className="rounded-[16px] border border-line bg-soft-green p-6 sm:p-8"
        role="status"
      >
        <h2 className="font-display text-xl font-bold text-navy">
          Request received
        </h2>
        <p className="mt-2 text-base text-slate">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="relative space-y-4 rounded-[16px] border border-line bg-white p-6 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8"
      noValidate
      data-analytics="contact_form"
    >
      {/* Honeypot */}
      <div className="absolute -left-[9999px] opacity-0" aria-hidden>
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Lead attribution for CRM / Search Console campaign tracking */}
      <input type="hidden" name="utm_source" value={attr.utm_source} />
      <input type="hidden" name="utm_medium" value={attr.utm_medium} />
      <input type="hidden" name="utm_campaign" value={attr.utm_campaign} />
      <input type="hidden" name="utm_content" value={attr.utm_content} />
      <input type="hidden" name="utm_term" value={attr.utm_term} />
      <input type="hidden" name="landing_page" value={attr.landing_page} />
      <input type="hidden" name="referrer_url" value={attr.referrer_url} />

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" autoComplete="name" required />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email && (
          <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          name="company"
          autoComplete="organization"
          required
        />
        {state.fieldErrors?.company && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.company[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Hiring need</Label>
        <Textarea
          id="message"
          name="message"
          required
          placeholder="Roles, team size, or what you need support with"
        />
        {state.fieldErrors?.message && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.message[0]}
          </p>
        )}
      </div>

      {state.error && (
        <p
          className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full min-h-11"
        disabled={pending}
        data-analytics="contact_form_submitted"
      >
        {pending ? "Sending..." : "Build Your Team"}
      </Button>
      <p className="text-center text-xs text-slate">
        We respond to qualified inquiries. No spam — just a clear next step.
      </p>
    </form>
  );
}
