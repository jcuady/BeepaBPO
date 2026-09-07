import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type EmployeeRow = Pick<
  Tables<"employees">,
  "id" | "organization_id" | "job_title" | "employee_number" | "profile_id"
>;

export async function resolveEmployeeForUser(
  userId: string,
): Promise<EmployeeRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, organization_id, job_title, employee_number, profile_id")
    .eq("profile_id", userId)
    .eq("employment_status", "active")
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
