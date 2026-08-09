import "server-only";
import { getServiceSupabase } from "./supabase-server";

export async function getTournamentBySlug(slug: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("tournament").select("*").eq("slug", slug).single();
  if (error || !data) return null;
  return data;
}

export async function getDivisionForTournament(tournamentId: string) {
  const supabase = getServiceSupabase();
  const { data } = await supabase.from("division").select("*").eq("tournament_id", tournamentId).limit(1).single();
  return data ?? null;
}

export async function getSetupProgress(tournamentId: string) {
  const supabase = getServiceSupabase();
  const [{ count: playerCount }, { count: teamCount }, { data: teams }] = await Promise.all([
    supabase.from("player").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId),
    supabase.from("team").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId),
    supabase.from("team").select("id, group_id").eq("tournament_id", tournamentId),
  ]);

  const teamsAssigned = teams?.filter((t) => t.group_id !== null).length ?? 0;

  return {
    playerCount: playerCount ?? 0,
    teamCount: teamCount ?? 0,
    teamsAssigned,
    teamsTotal: teams?.length ?? 0,
  };
}
