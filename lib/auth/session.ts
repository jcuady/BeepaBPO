import { createClient } from "@/lib/supabase/server";

/** @deprecated Supabase session cookies replace beepa_session. */
export const SESSION_COOKIE = "sb-auth-token";

/** @deprecated Use Supabase Auth session via createClient().auth.getUser() */
export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  verified: boolean;
  exp: number;
};

/** @deprecated */
export function encodeSession(payload: SessionPayload): string {
  void payload;
  throw new Error("Custom session cookies removed. Use Supabase Auth.");
}

/** @deprecated */
export function decodeSession(token: string): SessionPayload | null {
  void token;
  return null;
}

/** @deprecated */
export async function setSessionCookie(payload: SessionPayload) {
  void payload;
  throw new Error("Custom session cookies removed. Use Supabase Auth.");
}

/** @deprecated */
export async function clearSessionCookie() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    sub: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.display_name as string | undefined) ??
      user.email ??
      "",
    verified: Boolean(user.email_confirmed_at),
    exp: 0,
  };
}
