import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { can } from "@/lib/permissions/can";
import { notifyUser } from "@/lib/notifications/notify";

const bodySchema = z.object({
  userId: z.string().uuid().optional(),
  type: z.string().default("system.test"),
  title: z.string().min(1).default("Beepa test notification"),
  body: z.string().default("Push notifications are working."),
  actionUrl: z.string().optional(),
});

async function isAuthorized(request: Request) {
  const env = getEnv();
  const authHeader = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");

  if (env.CRON_SECRET) {
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (bearer === env.CRON_SECRET || cronSecret === env.CRON_SECRET) {
      return true;
    }
  }

  const workspace = await resolveWorkspace();
  if (workspace && can(workspace.permissions, "system.manage")) {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const workspace = await resolveWorkspace();
  const userId = body.userId ?? workspace?.user.id;

  if (!userId) {
    return NextResponse.json(
      { error: "userId required when not signed in as admin" },
      { status: 400 },
    );
  }

  try {
    const result = await notifyUser({
      userId,
      type: body.type,
      title: body.title,
      body: body.body,
      actionUrl: body.actionUrl,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send notification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
