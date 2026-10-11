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
  // KNOWN LIMIT, documented rather than hidden: this restores focus on the
  // Cancel / close-button path but NOT on Escape. A traced Escape close reads:
  //
  //   focusout from Cancel -> BODY   (t+378ms)
  //   dialog REMOVED                 (t+381ms)
  //   ...no focusin, ever. final activeElement BODY.
  //
  // Escape reaches Base UI's `closeOnFocusOut` branch, which sets
  // `preventReturnFocusRef.current = true` and suppresses return focus
  // outright. Three separate manual restores (an effect on `open`, a
  // `requestAnimationFrame`, and `onOpenChangeComplete` with a double frame)
  // were tried against it and none fired, because by the time they would run
  // the library has already decided not to return focus. See QA report §6.
  const returnFocusTo = useRef<HTMLElement | null>(null);

  // Capture while the dialog is still CLOSED. An effect keyed on `open` runs
  // after Base UI has already moved focus into the popup, so it would capture
  // the Cancel button — an element that is about to unmount.
  useEffect(() => {
    if (open) return;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target === document.body) return;
      if (target.closest('[data-slot="dialog-content"]')) return;
      returnFocusTo.current = target;
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
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
