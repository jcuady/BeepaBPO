import { NextResponse } from "next/server";
import { authorizeCronRequest, runCronJobs } from "@/lib/jobs/cron-jobs";

/** Scheduled reminders: missing clock-out, invoice overdue. */
export async function POST(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    job?: string;
    dryRun?: boolean;
  };

  const result = await runCronJobs({
    job: body.job ?? "all",
    dryRun: Boolean(body.dryRun),
  });

  return NextResponse.json(result);
}
