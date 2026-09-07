"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SerializedWorkspace } from "@/lib/app/serialize-workspace";
import { getMobileNav } from "@/lib/app/navigation";

type MobileBottomNavProps = {
  workspace: SerializedWorkspace;
};

export function MobileBottomNav({ workspace }: MobileBottomNavProps) {
  const pathname = usePathname();
  const items = getMobileNav(workspace);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app/my" &&
              item.href !== "/app/client" &&
              item.href !== "/app/applicant" &&
              pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-label={item.title}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                  isActive ? "text-green-strong" : "text-slate",
                )}
              >
                <Icon
                  stroke={1.75}
                  className={cn("size-5", isActive && "text-green")}
                />
                <span>{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
