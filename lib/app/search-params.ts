/** Parse Next.js searchParams safely for list filters. */

export function stringParam(
  value: string | string[] | undefined,
  fallback = "",
): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? fallback;
  return value?.trim() ?? fallback;
}

export function enumParam<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback?: T,
): T | undefined {
  const raw = stringParam(value);
  if (!raw) return fallback;
  return (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

export function dateParam(
  value: string | string[] | undefined,
): string | undefined {
  const raw = stringParam(value);
  if (!raw) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

/** Strip PostgREST ilike metacharacters before embedding in filters. */
export function sanitizeIlike(term: string, max = 80): string {
  return term.replace(/[%_,]/g, "").slice(0, max);
}

export function ilikePattern(term: string): string | undefined {
  const clean = sanitizeIlike(term);
  return clean ? `%${clean}%` : undefined;
}
