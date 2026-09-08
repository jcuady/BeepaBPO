"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SerializedWorkspace } from "@/lib/app/serialize-workspace";
import { getCommandLinks } from "@/lib/app/navigation";

type CommandSearchProps = {
  workspace: SerializedWorkspace;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function CommandSearch({
  workspace,
  open: openProp,
  onOpenChange,
}: CommandSearchProps) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;
  const router = useRouter();

  const links = getCommandLinks(
    workspace.permissions,
    workspace.isClient,
    workspace.isInternal,
    workspace.isApplicantOnly,
    workspace.clientPortalFlags,
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`${item.title} ${item.href}`}
                onSelect={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                <Icon stroke={1.75} className="size-4" />
                <span>{item.title}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function CommandSearchTrigger({
  workspace,
  children,
}: {
  workspace: SerializedWorkspace;
  children: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <CommandSearch
        workspace={workspace}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
