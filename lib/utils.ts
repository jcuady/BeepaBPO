import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Turn a Postgres enum value into readable text: `client_endorsement` becomes
 * `Client endorsement`.
 *
 * This is the *generic* humaniser, for enums that have no richer metadata.
 * An enum that carries meaning — an application stage, an approval outcome —
 * should use its own table instead, because `humanizeEnum` cannot tell an
 * applicant whether they are still in the running.
 */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/_/g, " ").trim();
  if (!spaced) return "—";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
