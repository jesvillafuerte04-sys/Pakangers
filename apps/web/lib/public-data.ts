import "server-only";
import { getServiceSupabase } from "./supabase-server";
import { getMatchList, type MatchListRow } from "./match-data";
import { getDisplayStandings, type DisplayStandingsGroup } from "./match-pipeline";

/** Like getTournamentBySlug, but mirrors the RLS policy: drafts are never public. */
export async function getPublicTournament(slug: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("tournament").select("*").eq("slug", slug).single();
  if (error || !data || data.status === "draft") return null;
  return data;
}

export type LandingSnapshot = {
  live: MatchListRow[];
  upcoming: MatchListRow[];
  standingsSnippet: { stageName: string; groupName: string; topTeamName: string; topTeamRecord: string }[];
};

export async function getLandingSnapshot(tournamentId: string): Promise<LandingSnapshot> {
  const [live, upcoming, standings] = await Promise.all([
    getMatchList(tournamentId, "live"),
    getMatchList(tournamentId, "upcoming"),
    getDisplayStandings(tournamentId),
  ]);

  const standingsSnippet = standings
    .filter((g) => g.standings.length > 0)
    .map((g) => {
      const top = g.standings[0]!;
      return { stageName: g.stageName, groupName: g.groupName, topTeamName: top.teamName, topTeamRecord: `${top.wins}-${top.losses}` };
    });

  return { live, upcoming: upcoming.slice(0, 3), standingsSnippet };
}

export type FinalResults = {
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
  standings: DisplayStandingsGroup[];
  allMatches: MatchListRow[];
};

export async function getFinalResults(tournamentId: string): Promise<FinalResults> {
  const supabase = getServiceSupabase();
  const [standings, allMatches, { data: stages }] = await Promise.all([
    getDisplayStandings(tournamentId),
    getMatchList(tournamentId, "all"),
    supabase.from("stage").select("id, key").eq("tournament_id", tournamentId),
  ]);

  async function winnerAndLoserNames(stageKey: string): Promise<{ winner: string | null; loser: string | null }> {
    const stage = stages?.find((s) => s.key === stageKey);
    if (!stage) return { winner: null, loser: null };
    const { data: match } = await supabase.from("match").select("id, home_team_id, away_team_id").eq("stage_id", stage.id).maybeSingle();
    if (!match) return { winner: null, loser: null };
    const { data: result } = await supabase.from("match_result").select("winner_team_id").eq("match_id", match.id).maybeSingle();
    if (!result?.winner_team_id) return { winner: null, loser: null };
    const loserId = result.winner_team_id === match.home_team_id ? match.away_team_id : match.home_team_id;
    const ids = [result.winner_team_id, loserId].filter((id): id is string => Boolean(id));
    const { data: teams } = ids.length ? await supabase.from("team").select("id, name").in("id", ids) : { data: [] };
    return {
      winner: teams?.find((t) => t.id === result.winner_team_id)?.name ?? null,
      loser: loserId ? teams?.find((t) => t.id === loserId)?.name ?? null : null,
    };
  }

  const [championship, thirdPlace] = await Promise.all([
    winnerAndLoserNames("championship"),
    winnerAndLoserNames("third_place"),
  ]);

  return {
    champion: championship.winner,
    runnerUp: championship.loser,
    thirdPlace: thirdPlace.winner,
    standings,
    allMatches,
  };
}
