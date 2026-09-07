import { getEnv } from "@/lib/env";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: "no_api_key" | "no_from" }
  | { ok: false; error: string };

/** Thin Resend HTTP client — no SDK dependency. */
export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    return { ok: false, skipped: true, reason: "no_api_key" };
  }

  const from = env.EMAIL_FROM?.trim() || "Beepa <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey
        ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) }
        : {}),
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  const body = (await res.json().catch(() => null)) as {
    id?: string;
    message?: string;
    name?: string;
  } | null;

  if (!res.ok) {
    return {
      ok: false,
      error: body?.message ?? body?.name ?? `Resend HTTP ${res.status}`,
    };
  }

  return { ok: true, id: body?.id ?? "unknown" };
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(getEnv().RESEND_API_KEY);
}
