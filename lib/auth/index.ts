import { createClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/auth/workspace";

export { resolveWorkspace, requirePermission } from "@/lib/auth/workspace";
export type { WorkspaceContext, MembershipWithOrg } from "@/lib/auth/workspace";

/** @deprecated Use resolveWorkspace() or supabase.auth.getUser() */
export async function getSession() {
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

export async function getWorkspace() {
  return resolveWorkspace();
}
