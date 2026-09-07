import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

type Admin = ReturnType<typeof createAdminClient>;

/** Invite by email, or resolve existing auth user id (demo-scale page-through). */
export async function inviteOrResolveAuthUser(
  admin: Admin,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    redirectNext?: string;
  },
): Promise<{ userId: string; invited: boolean } | { error: string }> {
  const site = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const next = input.redirectNext ?? "/employee/login";
  const redirectTo = `${site}/auth/callback?next=${encodeURIComponent(next)}`;
  const fullName = `${input.firstName} ${input.lastName}`.trim();

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo,
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        full_name: fullName,
        display_name: fullName,
      },
    });

  if (invited?.user?.id) {
    return { userId: invited.user.id, invited: true };
  }

  const already =
    inviteError?.message?.toLowerCase().includes("already") ||
    inviteError?.message?.toLowerCase().includes("registered");

  if (!already) {
    return {
      error: inviteError?.message ?? "Unable to send invite.",
    };
  }

  // ponytail: admin API has no getUserByEmail; page through for demo-scale orgs
  for (let page = 1; page <= 5; page += 1) {
    const { data: listed } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    const match = listed?.users.find(
      (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
    );
    if (match) return { userId: match.id, invited: false };
    if (!listed?.users?.length || listed.users.length < 200) break;
  }

  return { error: "Account exists but could not be resolved." };
}
