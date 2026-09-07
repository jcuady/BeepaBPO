"use client";

import { useSyncExternalStore } from "react";
import { IconWifiOff } from "@tabler/icons-react";

function subscribe(onChange: () => void) {
  window.addEventListener("offline", onChange);
  window.addEventListener("online", onChange);
  return () => {
    window.removeEventListener("offline", onChange);
    window.removeEventListener("online", onChange);
  };
}

export function OfflineBanner() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-navy px-4 py-2 text-sm text-white safe-area-inset-top"
    >
      <IconWifiOff stroke={1.75} className="size-4 shrink-0" />
      You&apos;re offline. Some features may be unavailable.
    </div>
  );
}
