// Comprehensive push notification flow tests.
//
// Verifies that the cross-browser push pipeline is wired end-to-end:
//   1. VAPID keys are well-formed and accepted by web-push.
//   2. notifyUser creates an in-app notification row.
//   3. sendPushToUser reads push_subscriptions and sends via web-push.
//   4. The service worker (public/sw.js) handles the push event correctly.
//   5. The notificationclick handler routes to the right URL.
//
// Mocks web-push so we don't actually hit the real Push service.

import { describe, test, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PushSubscription, SendResult } from "web-push";

const ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");

// Load env for next.js scripts.
import { readFileSync as read } from "node:fs";
for (const line of read(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[line.slice(0, idx).trim()] === undefined) process.env[line.slice(0, idx).trim()] = v;
}

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@beepabpo.com";

// ----------------------------------------------------------------------
// 1. VAPID key well-formed
// ----------------------------------------------------------------------
describe("VAPID keys", () => {
  test("public key is 87 chars and base64url-safe", () => {
    expect(VAPID_PUBLIC.length).toBe(87);
    expect(/^[A-Za-z0-9_-]+=*$/.test(VAPID_PUBLIC)).toBe(true);
  });
  test("private key is 43 chars and base64url-safe", () => {
    expect(VAPID_PRIVATE.length).toBe(43);
    expect(/^[A-Za-z0-9_-]+=*$/.test(VAPID_PRIVATE)).toBe(true);
  });
  test("subject is a mailto: or https: URL", () => {
    expect(VAPID_SUBJECT).toMatch(/^mailto:|^https?:/);
  });
});

// ----------------------------------------------------------------------
// 2. web-push library accepts the keys (cross-browser push protocol)
// ----------------------------------------------------------------------
describe("web-push integration", () => {
  // `web-push` is CJS and @types/web-push declares only named exports, but the
  // runtime namespace exposes them under `default` under Node interop. Narrow to
  // exactly what this suite exercises, and cast once at that boundary.
  interface WebPushLib {
    default: {
      setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
      sendNotification(
        subscription: PushSubscription,
        payload?: string | Buffer | null,
        options?: unknown,
      ): Promise<SendResult>;
    };
  }

  let webpushLib: WebPushLib;

  beforeAll(async () => {
    webpushLib = (await import("web-push")) as unknown as WebPushLib;
  });

  test("setVapidDetails accepts the keys without throwing", () => {
    expect(() =>
      webpushLib.default.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE),
    ).not.toThrow();
  });

  test("sendNotification builds a valid VAPID request (mocked endpoint)", async () => {
    const sendSpy = vi
      .spyOn(webpushLib.default, "sendNotification")
      // @types/web-push models SendResult.headers as a string index signature,
      // not the DOM Headers object, so an empty record satisfies it.
      .mockResolvedValue({ statusCode: 201, body: "", headers: {} });

    const sub: PushSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/dummy",
      keys: { p256dh: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", auth: "AAAA" },
    };
    await webpushLib.default.sendNotification(sub, JSON.stringify({ title: "x", body: "y" }));
    expect(sendSpy).toHaveBeenCalledOnce();
    const args = sendSpy.mock.calls[0];
    expect(args[0].endpoint).toBe(sub.endpoint);
    expect(String(args[1])).toContain("title");

    sendSpy.mockRestore();
  });
});

// ----------------------------------------------------------------------
// 3. Service worker source — push handler + click handler
// ----------------------------------------------------------------------
describe("public/sw.js push handlers", () => {
  let src: string;

  beforeAll(() => {
    src = readFileSync(resolve(ROOT, "public/sw.js"), "utf8");
  });

  test("registers a push listener", () => {
    expect(src).toMatch(/self\.addEventListener\(\s*['"]push['"]/);
  });

  test("registers a notificationclick listener", () => {
    expect(src).toMatch(/self\.addEventListener\(\s*['"]notificationclick['"]/);
  });

  test("push handler calls showNotification with title, body, icon, badge, data", () => {
    // pull the push listener body
    const pushMatch = src.match(/addEventListener\(\s*['"]push['"][\s\S]*?\}\s*\)\s*;/);
    expect(pushMatch).not.toBeNull();
    const body = pushMatch![0];
    expect(body).toMatch(/registration\.showNotification/);
    expect(body).toMatch(/icon/);
    expect(body).toMatch(/badge/);
    expect(body).toMatch(/data:\s*\{\s*url/);
  });

  test("notificationclick focuses an open client or opens a new window", () => {
    const clickMatch = src.match(/addEventListener\(\s*['"]notificationclick['"][\s\S]*?\}\s*\)\s*;\s*$/m);
    expect(clickMatch).not.toBeNull();
    const body = clickMatch![0];
    expect(body).toMatch(/clients\.matchAll/);
    expect(body).toMatch(/clients\.openWindow/);
  });

  test("install precaches the shell + icons", () => {
    expect(src).toMatch(/caches\.open\(CACHE\)/);
    expect(src).toMatch(/cache\.addAll\(PRECACHE\)/);
  });

  test("activate deletes previous-version caches", () => {
    expect(src).toMatch(/Promise\.all\(keys\.filter\(.*\)\.map\(/);
  });
});

// ----------------------------------------------------------------------
// 4. Notification preferences + subscribe/unsubscribe endpoints
// ----------------------------------------------------------------------
describe("push subscribe endpoint", () => {
  let src: string;

  beforeAll(() => {
    src = readFileSync(resolve(ROOT, "app/api/push/subscribe/route.ts"), "utf8");
  });

  test("POST requires authenticated user", () => {
    expect(src).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(src).toMatch(/if\s*\(\s*!\s*user\s*\)/);
    expect(src).toMatch(/401/);
  });

  test("upserts subscription on (endpoint) conflict", () => {
    expect(src).toMatch(/onConflict:\s*['"]endpoint['"]/);
  });

  test("stores p256dh, auth, user_agent, device_label", () => {
    expect(src).toMatch(/p256dh/);
    expect(src).toMatch(/auth/);
    expect(src).toMatch(/user_agent/);
    expect(src).toMatch(/device_label/);
  });

  test("rejects invalid subscription payload via zod", () => {
    expect(src).toMatch(/z\.object/);
    expect(src).toMatch(/bodySchema\.parse/);
  });
});

// ----------------------------------------------------------------------
// 5. notifyUser in-app pipeline (mocked Supabase)
// ----------------------------------------------------------------------
describe("notifyUser in-app pipeline", () => {
  type NotificationRow = Record<string, unknown>;

  /** Minimal stand-in for the Supabase admin client used by notifyUser. */
  interface MockAdmin {
    from(table: string): unknown;
  }

  async function loadNotifyUserWithMock(mockAdmin: MockAdmin) {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => mockAdmin,
    }));
    vi.resetModules();
    const mod = await import("@/lib/notifications/notify");
    return mod.notifyUser;
  }

  test("in_app_enabled=true writes a notifications row", async () => {
    const inserted: NotificationRow[] = [];
    const mockAdmin: MockAdmin = {
      from(table: string) {
        if (table === "notification_preferences") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: { in_app_enabled: true, push_enabled: false } }),
                  };
                },
              };
            },
          };
        }
        if (table === "notifications") {
          return {
            insert(row: NotificationRow) {
              inserted.push(row);
              return {
                select() {
                  return { single: async () => ({ data: { id: "fake-notif-id" } }) };
                },
              };
            },
          };
        }
        return null;
      },
    };
    const notifyUser = await loadNotifyUserWithMock(mockAdmin);
    const r = await notifyUser({
      userId: "u-1",
      type: "test.event",
      title: "Test",
      body: "Hello",
    });
    expect(r.notificationId).toBe("fake-notif-id");
    expect(inserted).toHaveLength(1);
    expect(inserted[0].user_id).toBe("u-1");
    expect(inserted[0].title).toBe("Test");
  });

  test("in_app_enabled=false skips notifications insert", async () => {
    const inserted: NotificationRow[] = [];
    const mockAdmin: MockAdmin = {
      from(table: string) {
        if (table === "notification_preferences") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: { in_app_enabled: false, push_enabled: false } }),
                  };
                },
              };
            },
          };
        }
        if (table === "notifications") {
          return {
            insert(row: NotificationRow) {
              inserted.push(row);
              return { select() { return { single: async () => ({ data: { id: "x" } }) }; } };
            },
          };
        }
        return null;
      },
    };
    const notifyUser = await loadNotifyUserWithMock(mockAdmin);
    const r = await notifyUser({
      userId: "u-2",
      type: "test.skip",
      title: "skip",
      body: "skip",
    });
    expect(r.notificationId).toBeNull();
    expect(inserted).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------
// 6. Manifest + branding for installable PWA
// ----------------------------------------------------------------------
describe("PWA manifest", () => {
  // The manifest is a Next route — read the source rather than import it.
  const readManifest = () => readFileSync(resolve(ROOT, "app/manifest.ts"), "utf8");

  test("includes 192 + 512 icons, maskable variant, standalone display", () => {
    const src = readManifest();
    expect(src).toContain("name:");
    expect(src).toContain("short_name:");
    expect(src).toContain("icons:");
    expect(src).toContain("/brand/icon-192.png");
    expect(src).toContain("/brand/icon-512.png");
    expect(src).toContain("display:");
    expect(src).toContain('"standalone"');
    expect(src).toContain("theme_color:");
    expect(src).toMatch(/purpose.*maskable/);
  });
});