import * as React from "react"
import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    // `text-base sm:text-sm` on the wrapper is deliberate, not a density choice.
    //
    // This used to be a bare `text-sm`, which set 14px on the whole subtree.
    // Anything inside a card that did not declare its own size inherited 14px on
    // a phone — including plain `<p>` elements that read as body copy.
    // `CardTitle` already compensated with `text-base`, so cards *looked* fine
    // while their paragraphs quietly violated the 16px-mobile rule. The
    // responsive auditor only flags text of 25+ characters, so short values like
    // "CloudPeak" never tripped it and the defect survived a full sweep.
    //
    // The fix follows the pattern the rest of the app already uses: readable on a
    // phone, dense on a desktop — the same approach `Input` and `Button` take for
    // the 44px touch floor. Add the comment above `className`, not inside `cn(...)`.
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-none border border-line bg-white py-(--card-spacing) text-base text-navy sm:text-sm shadow-sm ring-0 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-none *:[img:last-child]:rounded-none",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-none px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders an `<h2>`, not a `<div>`.
 *
 * Upstream shadcn uses a `<div>`, which means every card title in the app was
 * invisible to heading navigation and to the accessibility tree as a heading.
 * axe does not flag it — a `<div>` is not a *broken* heading, it is simply not
 * one — so this was found by writing a Playwright locator for a heading role
 * and watching it fail against a correct-looking page.
 *
 * The rest of the app already uses real headings (`PageHeader` is the `<h1>`,
 * with `<h2>`/`<h3>` below it), so this was the odd one out. `<h2>` sits
 * directly under the page `<h1>` and cannot introduce an axe heading-order skip.
 * Tailwind's preflight already normalises heading font-size, weight and margin
 * to `inherit`/`0`, and this element sets its own font and weight explicitly, so
 * the rendered result is unchanged.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-none border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
