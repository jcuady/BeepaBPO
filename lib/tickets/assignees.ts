import type { SupabaseClient } from "@supabase/supabase-js";
import { BEEPA_ORG_ID } from "@/lib/permissions/codes";
import { fetchAllByRange } from "@/lib/pagination/fetch-all";
import type { Database } from "@/types/database";

export type TicketAssigneeOption = {
  id: string;
  displayName: string;
};

/** Active Beepa internal members available as ticket assignees. */
export async function listTicketAssignees(
  supabase: SupabaseClient<Database>,
): Promise<TicketAssigneeOption[]> {
  // Paged rather than capped. The previous `.limit(100)` meant that once an org passed 100
  // internal members, everyone past that point simply did not appear as an assignee -- no
  // error, no indication, just a person who cannot be put on a ticket.
  //
  // `created_at` is not unique, so `id` is added as a tiebreaker: PostgREST breaks ties
  // arbitrarily and `.range()` across an unstable order can skip or repeat rows.
  const rows = await fetchAllByRange<{ user_id: string; profiles: unknown }>(
    (from, to) =>
      supabase
        .from("organization_memberships")
        .select("user_id, profiles:user_id(id, display_name)")
        .eq("organization_id", BEEPA_ORG_ID)
        .eq("membership_type", "internal")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    { pageSize: 100, maxPages: 50, label: "Loading ticket assignees" },
  );

  const options: TicketAssigneeOption[] = [];
  for (const row of rows) {
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
