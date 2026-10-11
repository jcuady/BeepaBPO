"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
};

/** Confirm before irreversible / status-changing mutations. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending = false,
  destructive = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  // Return focus to whatever opened the dialog.
  //
  // Base UI restores focus to its `Dialog.Trigger`. This dialog has no trigger:
  // it is opened by React state (`open={confirmOpen}`) from a `<select>`, a
  // button in a table row, a menu item — 21 different callers. With nothing
  // registered it fell back to `document.body`. Measured, not assumed: closing
  // this dialog left `document.activeElement === BODY`, so a keyboard user who
  // cancelled a status change was dumped at the top of the document and had to
  // Tab all the way back to the control they came from.
  //
  // `finalFocus` accepts a FUNCTION, and that is the part that matters. Reading
  // Base UI's FloatingFocusManager: with a plain boolean it resolves the target
  // from its own "previously focused" stack, which by close time holds whatever
  // was focused when the popup opened — the Cancel button, since focus moves
  // into the popup immediately. That element is unmounted by the time the
  // restore runs, so nothing is focused. Passing a function makes
  // `hasExplicitReturnFocus` true, which skips that lookup and focuses exactly
  // what we name.
  //
  // BOTH close paths are verified working — Escape (closeType "keyboard") and
  // Cancel (closeType "mouse") both return focus to the trigger. That was NOT
  // true on the first measurement, and why is worth keeping: the probe reported
  // Escape failing for several rounds while Cancel passed, which reads exactly
  // like an upstream library limitation. It was not. `finalFocus` was being
  // called on both paths with the right `closeType`; the callback simply had
  // nothing to return, because the probe moved focus to the <select> before
  // React had run the effect that registers the capture listener, so the very
  // first `focusin` was missed. A fresh browser context with a short settle
  // before the first interaction passes both.
  //
  // The version of this comment that was committed blamed Base UI's
  // `closeOnFocusOut` branch for suppressing return focus. That was WRONG: that
  // branch sits inside `else if (portalContext?.portalNode)`, which a modal
  // dialog never reaches. A diagnosis read out of the wrong branch of someone
  // else's source is worse than no diagnosis, because it sends the next person
  // to the wrong line with confidence.
  const returnFocusTo = useRef<HTMLElement | null>(null);

  // Capture the element to return to, while the dialog is still CLOSED.
  //
  // Two events are watched, not one, and the second is not belt-and-braces:
  //
  // - `focusin` covers keyboard and most mouse users.
  // - `pointerdown` covers Safari, where clicking a <button> does NOT focus it.
  //   Without this, every mouse user on Safari loses their place on close, and
  //   it would never show up in a Chromium-only test run.
  //
  // Both handlers ignore anything inside the popup, since this listener can
  // still be attached during the render that opens the dialog.
  useEffect(() => {
    if (open) return;
    const remember = (raw: EventTarget | null) => {
      const target = raw as HTMLElement | null;
      if (!target || target === document.body) return;
      const focusable = target.closest<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.closest('[data-slot="dialog-content"]')) return;
      returnFocusTo.current = focusable;
    };
    const onFocusIn = (event: FocusEvent) => remember(event.target);
    const onPointerDown = (event: Event) => remember(event.target);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        finalFocus={() => {
          const target = returnFocusTo.current;
          return target && document.contains(target) ? target : null;
        }}
        className="origin-center duration-200 data-open:zoom-in-95 data-closed:duration-100 data-closed:zoom-out-95 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="sm:justify-end">
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={pending}
              />
            }
          >
            {cancelLabel}
          </DialogClose>
          <Button
            type="button"
            className="min-h-11"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
