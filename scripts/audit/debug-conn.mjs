// Read-only audit script. Uses secret key ONLY to read schema + data shape.
// NEVER writes anything. NEVER logs the key.
import { createClient } from "@supabase/supabase-js";

// Accept either naming.
const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error("Missing env. Need SUPABASE_URL + (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY)");
  process.exit(1);
}
// Redact anything sensitive in case of accidental logs.
process.env.SUPABASE_SERVICE_ROLE_KEY = "[redacted]";
process.env.SUPABASE_SECRET_KEY = "[redacted]";

const sb = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Try organizations
const r1 = await sb.from("organizations").select("*", { count: "exact", head: true });
console.log("organizations status:", r1.status, r1.statusText, "count:", r1.count, "err:", r1.error?.message || "none");

// Try auth admin
const r2 = await sb.auth.admin.listUsers({ page: 1, perPage: 5 });
console.log("auth listUsers status:", r2.error?.status || 200, "err:", r2.error?.message || "none", "users:", r2.data?.users?.length ?? 0);
if (r2.data?.users?.length) {
  for (const u of r2.data.users) console.log("  -", u.email, u.created_at);
}