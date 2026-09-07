/** Reject protocol-relative and backslash URLs that pass a naive startsWith("/"). */
export function safeNext(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw) return fallback;
  if (!/^\/(?![\/\\])/.test(raw)) return fallback;
  return raw;
}
