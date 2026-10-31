import "server-only";
import { cache } from "react";
import { getServiceSupabase } from "./supabase-server";

export type TeamDisplay = {
  header: string;
  /**
   * The players' nicknames ("Meb & Rain"), falling back to first names, for
   * places a full roster is too long -- such as a tiebreak note.
   */
  short?: string;
  subtext: string | null;
};

/** Player names lead for singles/doubles; squad names lead for Team Wars (3+ players). */
export function formatTeamDisplay(
  teamName: string | null | undefined,
  playerNames: string[],
): TeamDisplay {
  const trimmedName = (teamName ?? "").trim();
  // Team Wars / Squads (3+ players): Squad name leads, player list is subtext
  if (playerNames.length > 2 && trimmedName) {
    return { header: trimmedName, subtext: playerNames.join(", ") };
  }
  // Singles: Single player name leads
  if (playerNames.length === 1) {
    return {
      header: playerNames[0]!,
      subtext: trimmedName && trimmedName.toLowerCase() !== playerNames[0]!.toLowerCase() ? trimmedName : null,
    };
  }
  // Doubles
  if (playerNames.length > 0) {
    return { header: playerNames.join(" / "), subtext: trimmedName || null };
  }
  return { header: trimmedName || "Unnamed team", subtext: null };
}

type TeamWithMembers = {
  id: string;
  name: string;
  team_member: {
    position: number;
    player: { id: string; first_name: string; last_name: string; nickname?: string | null } | null;
  }[];
};

/** Shapes a joined team row into its display form, ordering players by roster position. */
export function teamDisplayFromJoined(team: TeamWithMembers): TeamDisplay {
  const sortedMembers = [...(team.team_member ?? [])].sort((a, b) => a.position - b.position);
  const players = sortedMembers
    .filter((m): m is typeof m & { player: NonNullable<typeof m.player> } => Boolean(m.player))
    .map((m) => m.player);
  const playerNames = players.map((p) => `${p.first_name} ${p.last_name}`.trim()).filter(Boolean);
  const nicknames = players.map((p) => p.nickname?.trim() || p.first_name.trim()).filter(Boolean);
  const display = formatTeamDisplay(team.name, playerNames);
  return { ...display, short: nicknames.length ? nicknames.join(" & ") : display.header };
}

const TEAM_WITH_MEMBERS_SELECT = "id, name, team_member(position, player(id, first_name, last_name, nickname))";

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
