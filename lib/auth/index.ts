import { getSessionFromCookies } from "@/lib/auth/session";

export async function getSession() {
  return getSessionFromCookies();
}
