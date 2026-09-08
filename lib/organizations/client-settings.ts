import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ClientPortalFlags = {
  allowAttendanceView: boolean;
  allowBillingView: boolean;
  allowTicketing: boolean;
  allowTimesheetApproval: boolean;
};

const DEFAULT_FLAGS: ClientPortalFlags = {
  allowAttendanceView: true,
  allowBillingView: true,
  allowTicketing: true,
  allowTimesheetApproval: true,
};

/** Load portal feature flags for a client org (defaults on if row missing). */
export async function loadClientPortalFlags(
  supabase: SupabaseClient<Database>,
  clientOrganizationId: string,
): Promise<ClientPortalFlags> {
  const { data } = await supabase
    .from("client_settings")
    .select(
      "allow_attendance_view, allow_billing_view, allow_ticketing, allow_timesheet_approval",
    )
    .eq("client_organization_id", clientOrganizationId)
    .maybeSingle();

  if (!data) return { ...DEFAULT_FLAGS };

  return {
    allowAttendanceView: data.allow_attendance_view,
    allowBillingView: data.allow_billing_view,
    allowTicketing: data.allow_ticketing,
    allowTimesheetApproval: data.allow_timesheet_approval,
  };
}
