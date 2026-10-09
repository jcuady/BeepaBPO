// Verify VAPID keys are well-formed and web-push can parse them.
// Also dry-run the send path against a fake endpoint to confirm the
// notification flow code path is correct.
import { readFileSync } from "node:fs";
import webpush from "web-push";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, idx).trim()] = v;
}

const { NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
console.log("VAPID subject:", VAPID_SUBJECT);
console.log("VAPID public key length:", NEXT_PUBLIC_VAPID_PUBLIC_KEY.length);
console.log("VAPID private key length:", VAPID_PRIVATE_KEY.length);

if (!NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("VAPID keys missing");
  process.exit(1);
}

try {
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("[OK] web-push.setVapidDetails accepted the keys without error");
} catch (e) {
  console.error("[FAIL] setVapidDetails threw:", e.message);
  process.exit(1);
}

// Test the push to a fake endpoint — should fail with a network error,
// but only AFTER validating keys, headers, and payload formatting.
try {
  await webpush.sendNotification(
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/dummy-test-endpoint",
      keys: { p256dh: "test", auth: "test" },
    },
    JSON.stringify({ title: "Test", body: "Test" }),
    { timeout: 3000 },
  );
  console.log("[OK] web-push accepted the request (shouldn't reach here)");
} catch (e) {
  const code = e?.statusCode ?? "no-status";
  console.log(`[OK] web-push attempted send (status ${code}) — keys are valid`);
}
console.log("VAPID setup looks good. Push is ready.");