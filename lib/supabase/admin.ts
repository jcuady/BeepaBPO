import { createClient } from "@supabase/supabase-js";
import { getEnv, getServiceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

/** Server-only admin client. Never import from client components. */
export function createAdminClient() {
  const env = getEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
