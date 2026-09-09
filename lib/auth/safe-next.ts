/** Reject protocol-relative and backslash URLs that pass a naive startsWith("/"). */
const AUTH_PATHS = [
  "/login",
  "/signup",
  "/employee/login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth/callback",
] as const;

function pathOnly(raw: string): string {
  return raw.split("?")[0]?.split("#")[0] ?? raw;
}

function isAuthPath(path: string): boolean {
  return AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function safeNext(
  raw: string | null | undefined,
  fallback = "/app",
): string {
  if (!raw) return fallback;
  if (!/^\/(?![\/\\])/.test(raw)) return fallback;
  if (isAuthPath(pathOnly(raw))) return fallback;
  return raw;
}
