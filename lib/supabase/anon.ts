import { createClient } from "@supabase/supabase-js";
import { getEnv, getPublicSupabaseKey } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cookie-less anon client for public SEO surfaces (sitemap, etc.).
 * Avoids next/headers cookies() which can fail or force dynamic quirks on MetadataRoute.
 */
export function createAnonClient() {
  const env = getEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, getPublicSupabaseKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
