"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { IconDownload, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "beepa-pwa-install-dismissed";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const standalone = useSyncExternalStore(
    () => () => undefined,
    isStandalone,
    () => true,
  );
  const showIosTip = useSyncExternalStore(
    () => () => undefined,
    () => isIos() && !isStandalone(),
    () => false,
  );
  const storageDismissed = useSyncExternalStore(
    () => () => undefined,
    () => sessionStorage.getItem(DISMISS_KEY) === "1",
    () => true,
  );

  useEffect(() => {
    if (standalone) return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [standalone]);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (standalone || storageDismissed || dismissed) return null;

  if (showIosTip && !deferredPrompt) {
    return (
      <div className="fixed inset-x-4 bottom-20 z-40 rounded-xl border border-line bg-white p-4 shadow-lg md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-navy">Install Beepa</p>
            <p className="mt-1 text-xs text-slate">
              Tap Share, then &quot;Add to Home Screen&quot; for quick access and
              notifications.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss">
            <IconX stroke={1.75} className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-40 rounded-xl border border-line bg-white p-4 shadow-lg md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">Install Beepa</p>
          <p className="mt-1 text-xs text-slate">
            Add to your home screen for faster access and push alerts.
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss">
          <IconX stroke={1.75} className="size-4" />
        </Button>
      </div>
      <Button className="mt-3 w-full" size="sm" onClick={() => void install()}>
        <IconDownload stroke={1.75} className="size-4" />
        Install app
      </Button>
    </div>
  );
}
