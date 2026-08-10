import "server-only";
import { cache } from "react";
import { getServiceSupabase } from "./supabase-server";

// cache() dedups within a single render pass: the admin layout, the page, and
// generateMetadata all look up the same tournament, which was three identical
// round trips per navigation before this.
export const getTournamentBySlug = cache(async (slug: string) => {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("tournament").select("*").eq("slug", slug).single();
  if (error || !data) return null;
  return data;
});

export const getDivisionForTournament = cache(async (tournamentId: string) => {
  const supabase = getServiceSupabase();
  const { data } = await supabase.from("division").select("*").eq("tournament_id", tournamentId).limit(1).single();
  return data ?? null;
});

export const getSetupProgress = cache(async (tournamentId: string) => {
  const supabase = getServiceSupabase();
  const [{ count: playerCount }, { data: teams }] = await Promise.all([
    supabase.from("player").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId),
    supabase.from("team").select("id, group_id").eq("tournament_id", tournamentId),
  ]);

  const teamsAssigned = teams?.filter((t) => t.group_id !== null).length ?? 0;

  return {
    playerCount: playerCount ?? 0,
    teamCount: teams?.length ?? 0,
    teamsAssigned,
    teamsTotal: teams?.length ?? 0,
  };
});
