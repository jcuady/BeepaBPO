/**
 * Smoke: Sales + Marketing can authenticate and hold CRM + tickets permissions.
 * Exit 2 = RED, 0 = GREEN
 *
 * Seams:
 * - Auth login for demo sales/marketing
 * - RPC user_permission_codes includes crm.* + tickets.read/manage
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = resolve(process.cwd(), name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const raw = trimmed.slice(eq + 1).trim();
      const value = raw.replace(/^(['"])(.*)\1$/, "$2");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadEnv();

const REQUIRED = {
  sales: [
    "crm.read",
    "crm.manage",
    "crm.reports",
    "clients.read",
    "tickets.read",
    "tickets.manage",
  ],
  marketing: [
    "cms.manage",
    "crm.read",
    "crm.manage",
    "tickets.read",
    "tickets.manage",
  ],
};

async function checkRole(email, required) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const password = process.env.DEMO_PASSWORD;
  if (!url || !anon || !password) {
    throw new Error("Missing Supabase URL, anon key, or DEMO_PASSWORD");
  }

  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    return { email, ok: false, error: error?.message ?? "no session", missing: required };
  }

  const { data: codes, error: rpcError } = await client.rpc(
    "user_permission_codes",
  );
  await client.auth.signOut();

  if (rpcError) {
    return { email, ok: false, error: rpcError.message, missing: required };
  }

  const set = new Set(codes ?? []);
  const missing = required.filter((c) => !set.has(c));
  return {
    email,
    ok: missing.length === 0,
    missing,
    count: set.size,
  };
}

(async () => {
  const results = [
    await checkRole("sales@demo.beepabpo.com", REQUIRED.sales),
    await checkRole("marketing@demo.beepabpo.com", REQUIRED.marketing),
  ];
  const pass = results.every((r) => r.ok);
  console.log(JSON.stringify({ results, pass }, null, 2));
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
