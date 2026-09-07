"use client";

import { useCallback, useState } from "react";
import { getEnv } from "@/lib/env";

type PushState = "idle" | "loading" | "subscribed" | "denied" | "unsupported";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("idle");
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(async () => {
    setError(null);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      setError("Push notifications are not supported in this browser.");
      return false;
    }

    const vapidKey = getEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setError("Push is not configured on this server.");
      return false;
    }

    setState("loading");

    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setState("denied");
        setError("Notification permission was denied.");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid push subscription.");
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save subscription.");
      }

      setState("subscribed");
      return true;
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Failed to enable push.");
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return true;

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setState("idle");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unsubscribe.");
      return false;
    }
  }, []);

  return { state, error, subscribe, unsubscribe };
}
