import "server-only";
import { cache } from "react";
import { getServiceSupabase } from "./supabase-server";

export type TeamDisplay = { header: string; subtext: string | null };

/** Player names lead; the team name (if the organizer bothered to set one) is a secondary label. */
export function formatTeamDisplay(teamName: string | null | undefined, playerNames: string[]): TeamDisplay {
  const trimmedName = (teamName ?? "").trim();
  if (playerNames.length > 0) {
    return { header: playerNames.join(" / "), subtext: trimmedName || null };
  }
  return { header: trimmedName || "Unnamed team", subtext: null };
}

type TeamWithMembers = {
  id: string;
  name: string;
  team_member: { position: number; player: { first_name: string; last_name: string } | null }[];
};

/** Shapes a joined team row into its display form, ordering players by roster position. */
export function teamDisplayFromJoined(team: TeamWithMembers): TeamDisplay {
  const playerNames = [...team.team_member]
    .sort((a, b) => a.position - b.position)
    .map((m) => (m.player ? `${m.player.first_name} ${m.player.last_name}`.trim() : ""))
    .filter(Boolean);
  return formatTeamDisplay(team.name, playerNames);
}

const TEAM_WITH_MEMBERS_SELECT = "id, name, team_member(position, player(first_name, last_name))";

/**
 * Every team in a tournament, keyed by id, as one round trip -- the nested
 * select pulls team_member and player in the same request instead of three
 * chained queries. Wrapped in cache() so several components rendering the
 * same page share one fetch.
 */
export const getTournamentTeamDisplays = cache(async (tournamentId: string): Promise<Map<string, TeamDisplay>> => {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("team").select(TEAM_WITH_MEMBERS_SELECT).eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((t) => [t.id, teamDisplayFromJoined(t as TeamWithMembers)]));
});

/** Same shape, but for an arbitrary set of team ids that may span tournaments. */
export async function getTeamDisplayMap(teamIds: string[]): Promise<Map<string, TeamDisplay>> {
  const uniqueIds = [...new Set(teamIds)];
  if (uniqueIds.length === 0) return new Map();

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("team").select(TEAM_WITH_MEMBERS_SELECT).in("id", uniqueIds);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((t) => [t.id, teamDisplayFromJoined(t as TeamWithMembers)]));
}
