import { cn } from "@/lib/utils";

/**
 * The single marketing container.
 *
 * Width and padding are now `clamp()` rather than the fixed `px-4 sm:px-6
 * lg:px-8` ladder, because the new design widens the measure to 1360px and a
 * 64px desktop gutter cannot be expressed in that ladder without also applying
 * 64px at tablet. `clamp()` interpolates, so the brand's "do not treat mobile
 * as a shrunken desktop" rule holds at every width instead of only at the
 * breakpoints somebody remembered to check.
 *
 * There is deliberately no second container in `globals.css` — see
 * `.container-page` there, which the app-shell surfaces use.
 */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1360px] px-[clamp(1.25rem,4.5vw,4rem)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
