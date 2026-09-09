"use client";

import {
  useActionState,
  useId,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { IconArrowLeft, IconArrowRight, IconCheck } from "@tabler/icons-react";
import { contactAction } from "@/lib/contact/actions";
import type { ActionState } from "@/lib/auth/actions";
import { BRAND } from "@/lib/site";
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

type FormValues = {
  name: string;
  email: string;
  company: string;
  message: string;
};

const STEPS = [
  {
    id: "you",
    title: "About you",
    hint: "So we know who to follow up with.",
  },
  {
    id: "company",
    title: "Your company",
    hint: "Helps us match the right team model.",
  },
  {
    id: "need",
    title: "What you need",
    hint: "Roles, timing, or the support you need.",
  },
] as const;

/** Cached so useSyncExternalStore getSnapshot stays referentially stable. */
let attrCache: Attribution | null = null;

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

function getAttrSnapshot(): Attribution {
  if (!attrCache) attrCache = readAttribution();
  return attrCache;
}

function subscribeAttr() {
  return () => {};
}

function validateStep(step: number, values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (!values.name.trim()) errors.name = "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = "Enter a valid work email.";
    }
  }
  if (step === 1 && !values.company.trim()) {
    errors.company = "Company is required.";
  }
  if (step === 2 && values.message.trim().length < 10) {
    errors.message = "Tell us a bit more about what you need.";
  }
  return errors;
}

function stepForField(field: string): number {
  if (field === "name" || field === "email") return 0;
  if (field === "company") return 1;
  return 2;
}

export function ContactForm() {
  const formId = useId();
  const [state, action, pending] = useActionState(contactAction, initial);
  const [step, setStep] = useState(0);
  const [prevFieldErrors, setPrevFieldErrors] = useState(state.fieldErrors);
  const attr = useSyncExternalStore(
    subscribeAttr,
    getAttrSnapshot,
    () => EMPTY_ATTR,
  );
  const [values, setValues] = useState<FormValues>({
    name: "",
    email: "",
    company: "",
    message: "",
  });
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  // Render-time sync when server validation returns field errors.
  if (state.fieldErrors !== prevFieldErrors) {
    setPrevFieldErrors(state.fieldErrors);
    const fields = state.fieldErrors ? Object.keys(state.fieldErrors) : [];
    if (fields.length) {
      setStep(Math.min(...fields.map(stepForField)));
    }
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setLocalErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function goNext() {
    const errors = validateStep(step, values);
    setLocalErrors(errors);
    if (Object.keys(errors).length) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setLocalErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    // Enter in earlier steps must advance, not POST incomplete FormData.
    if (step < STEPS.length - 1) {
      e.preventDefault();
      goNext();
      return;
    }
    const errors = validateStep(step, values);
    if (Object.keys(errors).length) {
      e.preventDefault();
      setLocalErrors(errors);
    }
  }

  const fieldError = (key: keyof FormValues) =>
    localErrors[key] || state.fieldErrors?.[key]?.[0];

  if (state.ok) {
    return (
      <div
        className="rounded-[20px] border border-line bg-soft-green p-6 sm:p-8"
        role="status"
        aria-live="polite"
        data-contact-wizard="success"
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-green text-white">
          <IconCheck stroke={2.5} className="size-5" aria-hidden />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-navy">
          Request received
        </h2>
        <p className="mt-2 text-base leading-relaxed text-slate">
          {state.message}
        </p>
        <p className="mt-4 text-sm text-slate">
          A {BRAND.displayName} teammate will follow up shortly.
        </p>
      </div>
    );
  }

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <form
      action={action}
      onSubmit={onFormSubmit}
      className="relative space-y-6 rounded-[20px] border border-line bg-white p-6 shadow-[0_8px_30px_rgb(23_24_43/0.06)] sm:p-8"
      noValidate
      data-analytics="contact_form"
      data-contact-wizard="active"
      data-contact-step={current.id}
    >
      {/* Honeypot */}
      <div className="absolute -left-[9999px] opacity-0" aria-hidden>
        <Label htmlFor={`${formId}-website`}>Website</Label>
        <Input
          id={`${formId}-website`}
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Lead attribution for CRM / campaign tracking */}
      <input type="hidden" name="utm_source" value={attr.utm_source} />
      <input type="hidden" name="utm_medium" value={attr.utm_medium} />
      <input type="hidden" name="utm_campaign" value={attr.utm_campaign} />
      <input type="hidden" name="utm_content" value={attr.utm_content} />
      <input type="hidden" name="utm_term" value={attr.utm_term} />
      <input type="hidden" name="landing_page" value={attr.landing_page} />
      <input type="hidden" name="referrer_url" value={attr.referrer_url} />

      {/* Persist values across steps for FormData */}
      {step !== 0 ? (
        <>
          <input type="hidden" name="name" value={values.name} />
          <input type="hidden" name="email" value={values.email} />
        </>
      ) : null}
      {step !== 1 ? (
        <input type="hidden" name="company" value={values.company} />
      ) : null}
      {step !== 2 ? (
        <input type="hidden" name="message" value={values.message} />
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-green-strong">
            {BRAND.cta}
          </p>
          <p className="text-xs font-medium text-slate" aria-live="polite">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label={`Step ${step + 1} of ${STEPS.length}`}
        >
          <div
            className="h-full rounded-full bg-lime transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-4 flex gap-2" aria-hidden>
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-green" : "bg-line"
              }`}
            />
          ))}
        </ol>
        <h2 className="mt-5 font-display text-xl font-bold text-navy">
          {current.title}
        </h2>
        <p className="mt-1 text-sm text-slate">{current.hint}</p>
      </div>

      {step === 0 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-name`}>Name</Label>
            <Input
              id={`${formId}-name`}
              name="name"
              autoComplete="name"
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              aria-invalid={Boolean(fieldError("name"))}
              aria-describedby={
                fieldError("name") ? `${formId}-name-err` : undefined
              }
            />
            {fieldError("name") ? (
              <p
                id={`${formId}-name-err`}
                className="text-sm text-destructive"
                role="alert"
              >
                {fieldError("name")}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-email`}>Work email</Label>
            <Input
              id={`${formId}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
              aria-invalid={Boolean(fieldError("email"))}
              aria-describedby={
                fieldError("email") ? `${formId}-email-err` : undefined
              }
            />
            {fieldError("email") ? (
              <p
                id={`${formId}-email-err`}
                className="text-sm text-destructive"
                role="alert"
              >
                {fieldError("email")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-company`}>Company</Label>
          <Input
            id={`${formId}-company`}
            name="company"
            autoComplete="organization"
            required
            value={values.company}
            onChange={(e) => update("company", e.target.value)}
            aria-invalid={Boolean(fieldError("company"))}
            aria-describedby={
              fieldError("company") ? `${formId}-company-err` : undefined
            }
          />
          {fieldError("company") ? (
            <p
              id={`${formId}-company-err`}
              className="text-sm text-destructive"
              role="alert"
            >
              {fieldError("company")}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-message`}>Hiring need</Label>
          <Textarea
            id={`${formId}-message`}
            name="message"
            required
            rows={5}
            placeholder="Roles, team size, timeline, or what you need support with"
            value={values.message}
            onChange={(e) => update("message", e.target.value)}
            aria-invalid={Boolean(fieldError("message"))}
            aria-describedby={
              fieldError("message") ? `${formId}-message-err` : undefined
            }
          />
          {fieldError("message") ? (
            <p
              id={`${formId}-message-err`}
              className="text-sm text-destructive"
              role="alert"
            >
              {fieldError("message")}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p
          className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 gap-2 text-navy"
            onClick={goBack}
            disabled={pending}
          >
            <IconArrowLeft stroke={2} className="size-4" aria-hidden />
            Back
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className="group min-h-11 w-full gap-2 sm:w-auto sm:min-w-[10rem]"
            onClick={goNext}
          >
            Continue
            <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
              <IconArrowRight stroke={2} className="size-3" aria-hidden />
            </span>
          </Button>
        ) : (
          <Button
            type="submit"
            className="min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
            disabled={pending}
            data-analytics="contact_form_submitted"
          >
            {pending ? "Sending..." : "Build Your Team"}
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-slate">
        We respond to qualified inquiries. No spam — just a clear next step from{" "}
        {BRAND.displayName}.
      </p>
    </form>
  );
}
