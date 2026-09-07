import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications/notify";

export type CronJobName = "all" | "missing_clock_out" | "invoice_overdue";

export type CronRunOptions = {
  job?: CronJobName | string;
  dryRun?: boolean;
};

export type CronRunResult = {
  ok: true;
  dryRun: boolean;
  results: Record<string, number>;
};

/** Shared cron body used by HTTP route and admin smoke action. */
export async function runCronJobs(
  options: CronRunOptions = {},
): Promise<CronRunResult> {
  const admin = createAdminClient();
  const job = options.job ?? "all";
  const dryRun = Boolean(options.dryRun);
  const results: Record<string, number> = {};

  if (job === "all" || job === "missing_clock_out") {
    const today = new Date().toISOString().slice(0, 10);
    const { data: open } = await admin
      .from("attendance_records")
      .select("id, employee_id, employees(profile_id)")
      .eq("work_date", today)
      .not("clock_in_at", "is", null)
      .is("clock_out_at", null);

    let n = 0;
    for (const row of open ?? []) {
      const profileId = (
        row.employees as unknown as { profile_id: string } | null
      )?.profile_id;
      if (!profileId) continue;
      if (!dryRun) {
        await notifyUser({
          userId: profileId,
          type: "attendance.missing_clock_out",
          title: "Missing clock-out",
          body: "You are still clocked in. Remember to clock out when your shift ends.",
          actionUrl: "/app/my",
          entityType: "attendance_record",
          entityId: row.id,
        });
      }
      n += 1;
    }
    results.missing_clock_out = n;
  }

  if (job === "all" || job === "invoice_overdue") {
    if (dryRun) {
      const { count } = await admin
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .lt("due_date", new Date().toISOString().slice(0, 10));
      results.invoice_overdue = count ?? 0;
    } else {
      const { data: overdue } = await admin
        .from("invoices")
        .update({ status: "overdue" })
        .eq("status", "sent")
        .lt("due_date", new Date().toISOString().slice(0, 10))
        .select("id");
      results.invoice_overdue = overdue?.length ?? 0;
    }
  }

  return { ok: true, dryRun, results };
}

export function authorizeCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const headerSecret = request.headers.get("x-cron-secret");

  return bearer === secret || headerSecret === secret;
}
