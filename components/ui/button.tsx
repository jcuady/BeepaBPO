import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",

        /* ---- Editorial marketing variants -----------------------------
         *
         * The base class is square because the whole product UI is square: the
         * brand decision is one language across marketing, auth and the app
         * shell, not a marketing-only skin. An earlier revision deliberately
         * kept `rounded-lg` here on the grounds that dense tables and toolbars
         * read better with rounded controls; that was reversed, so the three
         * variants below are no longer distinguished by corner radius and now
         * differ only in fill and border.
         *
         * Height is NOT set here. `cva` appends the size variant after the
         * variant variant, so an `h-12` in this block would be overridden by
         * the default size's `h-8`. Marketing call sites pass `size="cta"` or
         * `size="editorial"` instead, which is also what keeps them reachable
         * from the size scale rather than hard-coded. */
        brand:
          "rounded-none bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:border-primary",
        editorial:
          "rounded-none border-t-0 border-r-0 border-l-0 border-b border-foreground/30 bg-transparent px-0 text-foreground hover:border-primary hover:bg-transparent hover:text-primary",
        inverse:
          "rounded-none bg-background text-foreground hover:bg-accent hover:text-accent-foreground",

        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Touch devices get a 44px minimum hit area (WCAG 2.5.5 target size);
// pointer-driven desktop keeps the dense controls. `xs` stays dense — it is
// the micro size for inline controls inside dense rows.
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [@media(pointer:coarse)]:min-h-11",
        xs: "h-6 gap-1 rounded-none px-2 text-xs in-data-[slot=button-group]:rounded-none has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-none px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-none has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 [@media(pointer:coarse)]:min-h-11",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [@media(pointer:coarse)]:min-h-11",
        /* Marketing scale. 48px clears the touch-target requirement outright
           rather than relying on the `pointer: coarse` escape hatch the product
           sizes use, because a marketing CTA is read on phones far more often
           than a toolbar control is. */
        cta: "h-12 gap-2 px-6 font-display text-[0.9375rem] font-semibold tracking-[-0.01em]",
        "cta-sm": "h-9 gap-1.5 px-4 font-display text-[0.8125rem] font-semibold",
        "editorial": "h-10 gap-2 font-display text-[0.9375rem] font-medium",
        icon: "size-8 [@media(pointer:coarse)]:size-11",
        "icon-xs":
          "size-6 rounded-none in-data-[slot=button-group]:rounded-none [&_svg:not([class*='size-'])]:size-3 [@media(pointer:coarse)]:size-11",
        "icon-sm":
          "size-7 rounded-none in-data-[slot=button-group]:rounded-none [@media(pointer:coarse)]:size-11",
        "icon-lg": "size-9 [@media(pointer:coarse)]:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
