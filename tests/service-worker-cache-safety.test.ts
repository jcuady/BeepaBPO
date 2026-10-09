// Service worker cache-safety tests.
//
// public/sw.js used to run a blanket cache-first strategy over every same-origin
// GET and precached "/app" during install. Both are data-leak vectors in a BPO
// deployment, where shared front-desk/kiosk devices are normal:
//
//   - Precaching "/app" stores whatever HTML the installer received (the
//     signed-in app shell, or the /login redirect) and then serves it to the
//     next person to open the app.
//   - Cache-first over authenticated navigations keeps the first employee's
//     rendered payslips and attendance records on disk and replays them to
//     whoever signs in next.
//
// These tests execute the real service worker source in a sandbox and drive the
// fetch handler, rather than pattern-matching the file, so the assertions
// describe runtime behaviour.

import { describe, test, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

const ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const SW_SRC = readFileSync(resolve(ROOT, "public/sw.js"), "utf8");

type FakeRequest = { method: string; url: string };

type FetchEvent = {
  request: FakeRequest;
  respondWith?: (response: Promise<unknown>) => void;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type Listener = (event: FetchEvent) => void;

/** Minimal stand-in for a browser Response — only the fields the SW reads. */
function makeResponse(body: string, { status = 200, type = "basic" } = {}) {
  const response = { body, status, type, clone: () => makeResponse(body, { status, type }) };
  return response;
}

type Harness = {
  listeners: Map<string, Listener>;
  cache: Map<string, unknown>;
  fetched: string[];
  fire: (event: FetchEvent) => Promise<{ responded: boolean; value?: unknown }>;
  install: () => Promise<void>;
};

const ORIGIN = "https://beepobpo.example.com";

function loadServiceWorker(): Harness {
  const listeners = new Map<string, Listener>();
  const cache = new Map<string, unknown>();
  const fetched: string[] = [];

  const sandbox = {
    URL,
    self: {
      addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
      skipWaiting: () => Promise.resolve(),
      registration: { showNotification: () => Promise.resolve() },
      clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) },
    },
    caches: {
      match: (request: FakeRequest) => Promise.resolve(cache.get(request.url)),
      open: () =>
        Promise.resolve({
          // A browser resolves precache entries against the SW's own origin.
          addAll: (urls: string[]) => {
            for (const url of urls) {
              cache.set(new URL(url, ORIGIN).toString(), makeResponse(`precached:${url}`));
            }
            return Promise.resolve();
          },
          put: (request: FakeRequest, response: unknown) => {
            cache.set(request.url, response);
            return Promise.resolve();
          },
        }),
      keys: () => Promise.resolve(["beepa-v1"]),
      delete: () => Promise.resolve(true),
    },
    fetch: (request: FakeRequest) => {
      fetched.push(request.url);
      return Promise.resolve(makeResponse("from-network"));
    },
  };

  createContext(sandbox);
  runInContext(SW_SRC, sandbox);

  /**
   * `responded: false` means the service worker declined the request by not
   * calling respondWith — the browser then performs the fetch itself. That is
   * the outcome we want for every authenticated route, and it means the
   * service worker never touches the Cache Storage on its behalf.
   */
  const fire = async (event: FetchEvent) => {
    let handled: Promise<unknown> | undefined;
    event.respondWith = (response) => {
      handled = response;
    };
    listeners.get("fetch")?.(event);
    if (!handled) return { responded: false };
    return { responded: true, value: await handled };
  };

  const install = async () => {
    let work: Promise<unknown> | undefined;
    listeners.get("install")?.({
      request: { method: "GET", url: "" },
      waitUntil: (p) => {
        work = p;
      },
    });
    await work;
  };

  return { listeners, cache, fetched, fire, install };
}

describe("service worker precache", () => {
  let sw: Harness;

  beforeEach(() => {
    sw = loadServiceWorker();
  });

  test("never precaches an authenticated route", async () => {
    await sw.install();

    // /app redirects to /login when signed out and renders the full workspace
    // when signed in. Either way it is user-specific and must not be stored.
    expect(sw.cache.has(`${ORIGIN}/app`)).toBe(false);
    for (const key of sw.cache.keys()) {
      expect(key.startsWith(`${ORIGIN}/app`)).toBe(false);
    }
  });

  test("precaches static brand icons so install resolves", async () => {
    await sw.install();
    expect(sw.cache.size).toBeGreaterThan(0);
    for (const key of sw.cache.keys()) {
      expect(key.startsWith(`${ORIGIN}/brand/`)).toBe(true);
    }
  });
});

describe("service worker fetch strategy", () => {
  let sw: Harness;

  beforeEach(() => {
    sw = loadServiceWorker();
  });

  test("does not serve authenticated navigations from cache", async () => {
    const target = `${ORIGIN}/app/my/payslips`;
    // Seed a stale cached copy, as the old blanket cache-first handler would.
    sw.cache.set(target, makeResponse("employee-one's payslips"));

    const { responded, value } = await sw.fire({ request: { method: "GET", url: target } });

    // The SW must decline the request outright so the browser goes to network.
    expect(responded).toBe(false);
    expect(value).toBeUndefined();
    expect((sw.cache.get(target) as { body?: string }).body).toBe("employee-one's payslips");
  });

  test("does not cache authenticated responses for later replay", async () => {
    const target = `${ORIGIN}/app/team/attendance`;

    const { responded } = await sw.fire({ request: { method: "GET", url: target } });

    expect(responded).toBe(false);
    expect(sw.cache.has(target)).toBe(false);
  });

  test("leaves API traffic entirely to the network", async () => {
    const target = `${ORIGIN}/api/push/subscribe`;
    const { responded } = await sw.fire({ request: { method: "GET", url: target } });
    expect(responded).toBe(false);
    expect(sw.cache.has(target)).toBe(false);
  });

  test("ignores non-GET requests", async () => {
    const { responded } = await sw.fire({
      request: { method: "POST", url: `${ORIGIN}/api/push/subscribe` },
    });
    expect(responded).toBe(false);
    expect(sw.cache.size).toBe(0);
  });

  test("still cache-firsts build-hashed static chunks", async () => {
    const target = `${ORIGIN}/_next/static/chunks/app-layout.js`;
    sw.cache.set(target, makeResponse("hashed-chunk"));

    const { responded, value } = await sw.fire({ request: { method: "GET", url: target } });

    // Content-addressed and auth-independent, so cache-first is correct here
    // and keeps repeat launches cheap.
    expect(responded).toBe(true);
    expect((value as { body?: string }).body).toBe("hashed-chunk");
    expect(sw.fetched).not.toContain(target);
  });

  test("caches build-hashed static chunks on first fetch", async () => {
    const target = `${ORIGIN}/_next/static/chunks/vendor.js`;

    const { responded, value } = await sw.fire({ request: { method: "GET", url: target } });

    expect(responded).toBe(true);
    expect((value as { body?: string }).body).toBe("from-network");
    expect(sw.cache.has(target)).toBe(true);
  });
});

describe("service worker push handlers survive the cache changes", () => {
  test("registers push and notificationclick listeners", () => {
    const sw = loadServiceWorker();
    expect(sw.listeners.has("push")).toBe(true);
    expect(sw.listeners.has("notificationclick")).toBe(true);
    expect(sw.listeners.has("install")).toBe(true);
    expect(sw.listeners.has("activate")).toBe(true);
  });
});