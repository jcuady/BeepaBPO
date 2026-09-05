"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-line", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger flex min-h-14 flex-1 items-center justify-between gap-4 py-4 text-left font-display text-base font-semibold text-navy transition-colors outline-none hover:text-green-strong focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      >
        {children}
        <IconChevronDown
          stroke={2}
          data-slot="accordion-trigger-icon"
          className="size-5 shrink-0 text-slate group-aria-expanded/accordion-trigger:hidden"
        />
        <IconChevronUp
          stroke={2}
          data-slot="accordion-trigger-icon"
          className="hidden size-5 shrink-0 text-slate group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden text-base text-slate transition-[height] duration-[220ms] ease-[var(--ease-out)] data-ending-style:h-0 data-starting-style:h-0"
      {...props}
    >
      <div className={cn("pb-5 pr-8 leading-relaxed", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
