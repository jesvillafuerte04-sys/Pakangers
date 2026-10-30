"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@pakangers/db";

// Which column scopes each table to one tournament. "tournament" is keyed on
// its own id -- filtering it on tournament_id names a column that does not
// exist, and Realtime rejects the whole subscription when any filter is
// invalid, which silently killed live updates for every table here.
const SCOPED_TABLES = [
  { table: "tournament", column: "id" },
  { table: "stage", column: "tournament_id" },
  { table: "match", column: "tournament_id" },
] as const;

// game and match_result have no tournament id at all, so they are watched
// unfiltered. A score correction that leaves match.status unchanged shows up
// only here, and a refresh triggered by another tournament's score is
// harmless -- it just re-reads this one.
const UNSCOPED_TABLES = ["match_result", "game"] as const;

/**
 * Subscribes to Supabase Realtime for this tournament and re-runs the
 * server-component data fetch (router.refresh()) whenever anything changes --
 * see docs/08-deployment.md: "Supabase Realtime, not polling." Debounced so a
 * burst of related writes only triggers one refresh.
 */
export function RealtimeRefresher({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;

    const supabase = createBrowserClient(url, anonKey);
    const channel = supabase.channel(`public-tournament-${tournamentId}`);

    const scheduleRefresh = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => router.refresh(), 500);
    };

    for (const { table, column } of SCOPED_TABLES) {
      channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table, filter: `${column}=eq.${tournamentId}` } as never,
        scheduleRefresh,
      );
    }
    for (const table of UNSCOPED_TABLES) {
      channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table } as never,
        scheduleRefresh,
      );
    }
    channel.subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  return null;
}
