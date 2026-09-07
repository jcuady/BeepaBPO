import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

export type AuditInput = {
  actorUserId: string;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Json | null;
  after?: Json | null;
};

/** Append-only audit row. Failures are swallowed so mutations still succeed. */
export async function logAudit(supabase: Client, input: AuditInput) {
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: input.actorUserId,
      organization_id: input.organizationId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      before_data: input.before ?? null,
      after_data: input.after ?? null,
    });
  } catch {
    // Non-blocking
  }
}
