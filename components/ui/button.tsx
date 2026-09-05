import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[8px] border border-transparent font-display text-sm font-semibold whitespace-nowrap transition-[transform,background-color,color,border-color,box-shadow] duration-150 ease-[var(--ease-out)] outline-none select-none focus-visible:ring-2 focus-visible:ring-green-strong focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-green-strong text-white hover:bg-[#095a2b] shadow-[0_1px_2px_rgb(23_24_43/0.08)]",
        secondary:
          "border-line bg-white text-navy hover:bg-mist hover:border-navy/20",
        outline:
          "border-navy/20 bg-transparent text-navy hover:bg-white/10 hover:border-navy/40",
        ghost: "bg-transparent text-navy hover:bg-mist",
        link: "text-green-strong underline-offset-4 hover:underline p-0 h-auto",
        navy: "bg-navy text-white hover:bg-[#181944]",
      },
      size: {
        default: "h-11 min-h-11 px-5",
        sm: "h-11 min-h-11 px-4 text-sm",
        lg: "h-12 min-h-12 px-6 text-base",
        icon: "size-11 min-h-11 min-w-11",
        "icon-sm": "size-11 min-h-11 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

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
  );
}

export { Button, buttonVariants };
