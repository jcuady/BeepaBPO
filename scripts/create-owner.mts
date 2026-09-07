import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BEEPA_ORG_ID = "11111111-1111-1111-1111-111111111111";

function loadEnvFiles() {
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

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "Owner",
    lastName: parts.slice(1).join(" ") || "User",
  };
}

async function attachRole(membershipId: string, roleCode: string) {
  const admin = createAdminClient();
  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .single();
  if (!role) throw new Error(`Role not found: ${roleCode}`);

  await admin.from("membership_roles").upsert(
    { membership_id: membershipId, role_id: role.id },
    { onConflict: "membership_id,role_id" },
  );
}

async function main() {
  loadEnvFiles();

  const email = process.argv[2] ?? process.env.OWNER_EMAIL;
  const fullName = process.argv[3] ?? process.env.OWNER_NAME ?? "Beepa Owner";
  const password =
    process.argv[4] ??
    process.env.OWNER_PASSWORD ??
    process.env.DEMO_PASSWORD;

  if (!email || !password) {
    console.error(
      "Usage: pnpm create-owner [email] [fullName] [password]\n" +
        "Or set OWNER_EMAIL, OWNER_NAME, and OWNER_PASSWORD / DEMO_PASSWORD in env.",
    );
    process.exit(1);
  }

  const admin = createAdminClient();
  const { firstName, lastName } = splitName(fullName);

  const { data: listed } = await admin.auth.admin.listUsers();
  const existing = listed?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        display_name: fullName,
      },
    });
    if (error || !data.user) {
      console.error("Failed to create owner:", error?.message ?? "unknown error");
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`Created auth user ${email}`);
  } else {
    console.log(`Auth user already exists: ${email}`);
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .upsert(
      {
        user_id: userId,
        organization_id: BEEPA_ORG_ID,
        membership_type: "internal",
        status: "active",
        is_primary: true,
      },
      { onConflict: "organization_id,user_id" },
    )
    .select("id")
    .single();

  if (membershipError || !membership) {
    console.error("Failed to create membership:", membershipError?.message);
    process.exit(1);
  }

  await attachRole(membership.id, "owner");
  console.log(`Owner role attached for ${email} in BeePA org (${BEEPA_ORG_ID})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
