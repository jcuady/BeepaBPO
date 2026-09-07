import { getEnv } from "@/lib/env";
import { DEMO_USERS, type DemoPortal, type DemoUser } from "@/lib/demo/users";

export type DemoLoginConfig = {
  password: string;
  users: readonly DemoUser[];
  portal: DemoPortal;
};

/**
 * Demo autofill is available when DEMO_PASSWORD is set and either:
 * - NODE_ENV is not production, or
 * - ALLOW_DEMO_LOGIN=true (explicit opt-in for staging/preview)
 */
export function getDemoLoginConfig(
  portal: DemoPortal,
): DemoLoginConfig | null {
  const env = getEnv();
  const password = env.DEMO_PASSWORD?.trim();
  if (!password) return null;

  const allowInProd = env.ALLOW_DEMO_LOGIN === "true";
  if (env.NODE_ENV === "production" && !allowInProd) return null;

  return {
    password,
    users: DEMO_USERS,
    portal,
  };
}
