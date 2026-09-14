"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RealtimeTable = {
  table: string;
  filter?: string;
};

type RealtimeRefreshProps = {
  tables: RealtimeTable[];
  /** ponytail: debounce storms when multiple rows change at once. */
  debounceMs?: number;
};

export function RealtimeRefresh({
  tables,
  debounceMs = 400,
}: RealtimeRefreshProps) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const specKey = tables
    .map((spec) => `${spec.table}:${spec.filter ?? ""}`)
    .join("|");

  useEffect(() => {
    const specs = specKey
      .split("|")
      .filter(Boolean)
      .map((entry) => {
        const sep = entry.indexOf(":");
        const table = sep === -1 ? entry : entry.slice(0, sep);
        const filter = sep === -1 ? undefined : entry.slice(sep + 1);
        return { table, filter: filter || undefined };
      });
    if (specs.length === 0) return;

    const supabase = createClient();
    const channel = supabase.channel(`live:${specKey}`);

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        router.refresh();
      }, debounceMs);
    };

    for (const spec of specs) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: spec.table,
          ...(spec.filter ? { filter: spec.filter } : {}),
        },
        bump,
      );
    }

    void channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [specKey, debounceMs, router]);

  return null;
}
