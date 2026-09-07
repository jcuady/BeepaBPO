import type { Json } from "@/types/database";

export const ABOUT_SETTING_KEY = "public_about";

export type AboutPageContent = {
  headline: string;
  body: string;
};

export function parseAboutSetting(value: Json | null | undefined): AboutPageContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const headline = value.headline;
  const body = value.body;
  if (typeof headline !== "string" || typeof body !== "string") return null;
  if (!headline.trim() || !body.trim()) return null;
  return { headline: headline.trim(), body: body.trim() };
}
