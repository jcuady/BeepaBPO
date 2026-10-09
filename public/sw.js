// ponytail: minimal SW — precache shell + push handlers, no Serwist/Turbopack coupling
const CACHE = "beepa-v1";
// Only ever static, auth-independent files. Precaching a dynamic route such as
// "/app" stores whatever HTML the installer happened to get back — the signed-in
// app shell, or the /login redirect — and then serves it to everybody afterwards.
const PRECACHE = ["/brand/icon-192.svg", "/brand/icon-512.svg"];

// Only build-hashed static chunks are cacheable. Everything else (navigations,
// /api/*, and every authed route) must go straight to the network: caching it
// would leak one employee's rendered payslips/attendance to the next person to
// pick up a shared device, and would pin the app to a stale shell.
const CACHEABLE = /^\/_next\/static\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const { request } = event;
  if (!CACHEABLE.test(new URL(request.url).pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = { title: "Beepa", body: "", url: "/app/my/notifications" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/brand/icon-192.svg",
      badge: "/brand/icon-192.svg",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/my/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
