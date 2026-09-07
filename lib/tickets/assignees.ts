import type { SupabaseClient } from "@supabase/supabase-js";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import type { Database } from "@/types/database";

export type TicketAssigneeOption = {
  id: string;
  displayName: string;
};

/** Active Beepa internal members available as ticket assignees. */
export async function listTicketAssignees(
  supabase: SupabaseClient<Database>,
): Promise<TicketAssigneeOption[]> {
  const { data } = await supabase
    .from("organization_memberships")
    .select("user_id, profiles:user_id(id, display_name)")
    .eq("organization_id", BEEPA_ORG_ID)
    .eq("membership_type", "internal")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(100);

  const options: TicketAssigneeOption[] = [];
  for (const row of data ?? []) {
    const profile = row.profiles as {
      id: string;
      display_name: string | null;
    } | null;
    if (!row.user_id) continue;
    options.push({
      id: row.user_id,
      displayName: profile?.display_name?.trim() || "Teammate",
    });
  }

  options.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return options;
}
