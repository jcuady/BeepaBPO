# Push Notifications

How web push works in BeepoBeepa, what has been verified, and what still needs a
real device to confirm. Read this before claiming push is working.

## Architecture

```
client                        server                       push service
──────                        ──────                       ───────────
usePushSubscription()   ──▶  POST /api/push/subscribe  ──▶  (stored in
  · Notification.permission       (authenticated)             push_subscriptions)
  · pushManager.subscribe
  · posts endpoint + keys

notifyUser({ userId })  ──▶  notification_preferences check
  lib/notifications/notify.ts    │
                                  ├──▶ INSERT notifications      (in-app, RLS'd)
                                  └──▶ sendPushToUser()
                                        reads push_subscriptions
                                        web-push (VAPID)
                                        ──────────────────────────▶  FCM/APNs
                                                                       │
public/sw.js  ◀────────────────────────────────────────────────────────┘
  "push"           → registration.showNotification(title, { body, icon, badge, data.url })
  "notificationclick" → focus an open window on that url, else clients.openWindow(url)
```

There is exactly **one** sanctioned write path for notifications:
`notifyUser()` in `lib/notifications/notify.ts`. It always keys on
`params.userId`, never on the caller's session, and it is the only place that
dispatches push. If you add another writer, you break per-user notification
correctness — see `docs/SYSTEM_AUDIT.md` §14.

### Storage and RLS

`push_subscriptions` is defined in
`supabase/migrations/20260906000300_notifications_audit_approvals.sql` and
protected by the `push_subs_own` policy in `..._rls_phase1.sql`:

```sql
create policy push_subs_own
  on public.push_subscriptions for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

Subscribe upserts on the `endpoint` conflict target while setting
`user_id = auth.uid()`, so the `with check` clause holds. A user can therefore
only ever write their own subscription rows.

## Required environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Exposed to the browser for `pushManager.subscribe`. |
| `VAPID_PRIVATE_KEY` | Server-only; signs the VAPID JWT for delivery. |
| `VAPID_SUBJECT` | `mailto:` or `https:` contact required by the Push spec. |

Generate a keypair with:

```bash
npx web-push generate-vapid-keys
```

Never commit key material. Reference the variable names only.

## Service worker scope

`components/pwa/register-sw.tsx` registers `/sw.js` with `{ scope: "/" }`.
This is mandatory, not cosmetic: a worker served from `/sw.js` already has the
widest scope the spec allows, and iOS Safari will refuse to deliver push to an
Add-to-Home-Screen icon whose service worker does not cover the app's routes.

## What the service worker caches (and what it must never cache)

`public/sw.js` runs a deliberately narrow cache: **only build-hashed chunks
under `/_next/static/`**. Every navigation, every `/api/*` request, and every
authenticated route is passed straight to the network.

This is a security boundary, not a performance preference. In a BPO deployment
shared front-desk and kiosk devices are normal, and the earlier blanket
cache-first handler had two concrete leak paths:

- **Install-time.** `PRECACHE` contained `"/app"`. At install time that response
  is either the signed-in app shell (server-rendered, containing that
  employee's data) or a redirect to `/login`. Whichever it was, it was stored
  under the `"/app"` cache key and then served to everybody afterwards.
- **Request-time.** Any same-origin `basic` GET response was written to the
  cache and served cache-first on the next load, so the first employee's
  rendered payslips and attendance records were replayed to the next person to
  sign in on the same device.

The trade-off is deliberate: with the narrow policy, an offline navigation shows
the browser's offline error page instead of a cached app shell. Showing someone
else's payslip is worse than showing nothing.

`tests/service-worker-cache-safety.test.ts` executes the real service worker
source in a sandbox and drives the `fetch` and `install` handlers. It fails 5/9
against the old blanket strategy and passes 9/9 against the current one — verify
that yourself if you change the handler.

## Web app manifest

`app/manifest.ts` sets:

- `id: "/app"` — explicit identity. Without it the browser derives identity from
  `start_url`, so any later `start_url` change makes the app look brand new and
  the user gets a second install prompt next to the first.
- `start_url: "/app"` — employees install the app to reach their workspace, not
  the marketing homepage.
- `scope: "/"` — must cover the app routes for push to work.
- 192px + 512px icons, including a `maskable` variant.

## Browser support

| Browser | Desktop | iOS | Android |
| --- | --- | --- | --- |
| Chrome / Edge | Yes | n/a | Yes |
| Firefox | Yes | n/a | n/a |
| Safari | Yes (macOS) | **Yes, iOS 16.4+, Add to Home Screen only** | n/a |

iOS Safari is the strict case. It requires **both** iOS 16.4 or later **and**
that the app was added to the Home Screen. A push permission prompt shown in a
normal Safari tab will never appear. This is a platform constraint, not
something the app can work around.

In-app notifications always work regardless: they are ordinary rows in the
`notifications` table rendered server-side.

## Verified vs. not verified

Be precise about this. The following is **verified**:

- The subscribe/unsubscribe endpoints require an authenticated session and
  return `401` without one.
- The unsubscribe route scopes its delete to `user_id = auth.uid()`, so a user
  cannot remove another user's subscription.
- `notifyUser` is the only application write path to `notifications`, and it
  always keys on `params.userId`.
- Cross-user isolation: `scripts/audit/test-notification-isolation.mjs` inserts
  rows for two users and asserts no third `user_id` appears — **0 leaks**.
- VAPID keys are well-formed and accepted by `web-push`
  (`tests/push-notification-flow.test.ts`).
- The service worker installs, activates, and its push/click handlers behave
  correctly (`tests/service-worker-cache-safety.test.ts`, §3 of
  `tests/push-notification-flow.test.ts`).
- `/api/push/send` is guarded by `system.manage` or a matching `CRON_SECRET`.

The following is **NOT verified — requires a real device**:

- End-to-end delivery from `web-push` through FCM/APNs to an on-screen
  notification.
- Automatic pruning of dead subscriptions. The `404`/`410` branch in
  `sendPushToUser` deletes them, but it has never been observed firing against
  a real push service.

### Why headless Chromium cannot close this

`scripts/audit/test-push-roundtrip.mjs` launches Chromium against the production
build, registers the service worker at root scope, calls
`pushManager.subscribe`, POSTs to `/api/push/subscribe`, and fires
`/api/push/send`. It reliably **hangs at the subscribe step**.

The reason is environmental, not a product defect: headless Chromium exposes a
PushManager, but its browser push endpoint is a phantom — the FCM handshake it
initiates never yields a deliverable endpoint, so `subscribe()` never resolves.
A 30-second timeout was added so the script fails fast instead of hanging, and
its verdict is a **blocker**, not a pass. Treat a green run of this script as
meaning nothing; it is a reachability probe, not a delivery test.

### Manual verification runbook

On a real device, signed in as an employee:

1. Chrome (desktop or Android), or iOS Safari 16.4+ **after** Add to Home
   Screen from the Share sheet.
2. Open **Notifications** in the app nav (`/app/my/notifications`) and enable
   push with the "Push notifications" switch. The toggle lives on this page,
   driven by `components/app/notifications-page-client.tsx` via
   `usePushSubscription()` — there is no separate Settings screen.
3. Grant the permission prompt.
4. Confirm the toggle reports subscribed.
5. From a second account with `system.manage`, send a test push:

   ```bash
   curl -X POST http://localhost:3000/api/push/send \
     -H "Content-Type: application/json" \
     -H "x-cron-secret: $CRON_SECRET" \
     -d '{"title":"Beepa test","body":"Push is working."}'
   ```

6. The notification must appear within a few seconds. Tapping it must focus or
   open `/app/my/notifications`.
7. Disable push in the app's Notifications page and confirm
   `pushManager.getSubscription()` returns null and the `push_subscriptions`
   row is gone.

Record the result in `docs/CHANGELOG.md`. Until step 6 has been observed on real
hardware, this document is the record of what is known, and the answer to "is
push working?" remains **unverified**.