"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@pakangers/db";

// game and match_result have no tournament_id column of their own, but every
// score write (writeMatchResult) always also updates the match row (status),
// and every newly-populated bracket match is an insert into match -- so
// subscribing to these three tournament-scoped tables catches every change
// that matters without an invalid filter on a column that doesn't exist.
const TOURNAMENT_SCOPED_TABLES = ["tournament", "stage", "match"] as const;

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

    for (const table of TOURNAMENT_SCOPED_TABLES) {
      channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table, filter: `tournament_id=eq.${tournamentId}` } as never,
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
