import "server-only";
import { cache } from "react";
import { getServiceSupabase } from "./supabase-server";
import { getMatchList, type MatchListRow } from "./match-data";
import { getDisplayStandings, type DisplayStandingsGroup } from "./match-pipeline";
import { getTournamentTeamDisplays, type TeamDisplay } from "./team-display";

/**
 * Like getTournamentBySlug, but mirrors the RLS policy: drafts are never public.
 * cache()d because generateMetadata, the layout, and the page each ask for it --
 * three identical round trips per navigation before this.
 */
export const getPublicTournament = cache(async (slug: string) => {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("tournament").select("*").eq("slug", slug).single();
  if (error || !data || data.status === "draft") return null;
  return data;
});

export type LandingSnapshot = {
  live: MatchListRow[];
  upcoming: MatchListRow[];
  standingsSnippet: { stageName: string; groupName: string; topTeam: TeamDisplay; topTeamRecord: string }[];
};

export async function getLandingSnapshot(tournamentId: string): Promise<LandingSnapshot> {
  // Both getMatchList calls share one cached fetch of the underlying rows.
  const [live, upcoming, standings] = await Promise.all([
    getMatchList(tournamentId, "live"),
    getMatchList(tournamentId, "upcoming"),
    getDisplayStandings(tournamentId),
  ]);

  const standingsSnippet = standings
    .filter((g) => g.standings.length > 0)
    .map((g) => {
      const top = g.standings[0]!;
      return { stageName: g.stageName, groupName: g.groupName, topTeam: top.team, topTeamRecord: `${top.wins}-${top.losses}` };
    });

  return { live, upcoming: upcoming.slice(0, 3), standingsSnippet };
}

export type FinalResults = {
  champion: TeamDisplay | null;
  firstRunnerUp: TeamDisplay | null;
  secondRunnerUp: TeamDisplay | null;
  thirdRunnerUp: TeamDisplay | null;
  standings: DisplayStandingsGroup[];
  allMatches: MatchListRow[];
};

export type PublicRules = {
  scoringByStage: { stageName: string; pointsToWin: number; winBy: string; bestOf: number; cap: number | null }[];
  ruleSet: { name: string; governingBody: string; editionYear: number; sourceUrl: string } | null;
  tournamentRules: { category: string; title: string; summaryText: string }[];
};

export async function getPublicRules(tournamentId: string): Promise<PublicRules> {
  const supabase = getServiceSupabase();
  // rule_set comes back nested on the tournament row rather than as a follow-up query.
  const [{ data: tournament }, { data: stages }, { data: rules }] = await Promise.all([
    supabase
      .from("tournament")
      .select("rule_set(name, governing_body, edition_year, source_url)")
      .eq("id", tournamentId)
      .single(),
    supabase.from("stage").select("name, sequence, scoring_config").eq("tournament_id", tournamentId).order("sequence"),
    supabase
      .from("tournament_rule")
      .select("category, title, summary_text, display_order")
      .or(`tournament_id.eq.${tournamentId},tournament_id.is.null`)
      .order("display_order"),
  ]);

  const rs = tournament?.rule_set ? (Array.isArray(tournament.rule_set) ? tournament.rule_set[0] : tournament.rule_set) : null;

  return {
    scoringByStage: (stages ?? []).map((s) => {
      const cfg = s.scoring_config as unknown as { pointsToWin: number; winBy: string; bestOf: number; cap?: number };
      return { stageName: s.name, pointsToWin: cfg.pointsToWin, winBy: cfg.winBy, bestOf: cfg.bestOf, cap: cfg.cap ?? null };
    }),
    ruleSet: rs ? { name: rs.name, governingBody: rs.governing_body, editionYear: rs.edition_year, sourceUrl: rs.source_url } : null,
    tournamentRules: (rules ?? []).map((r) => ({ category: r.category, title: r.title, summaryText: r.summary_text })),
  };
}

export async function getFinalResults(tournamentId: string): Promise<FinalResults> {
  const supabase = getServiceSupabase();
  // The podium needs both sides of the championship and third-place matches.
  // One nested query replaces the previous stage -> match -> match_result chain.
  const [standings, allMatches, { data: finalStages }, teamDisplayById] = await Promise.all([
    getDisplayStandings(tournamentId),
    getMatchList(tournamentId, "all"),
    supabase
      .from("stage")
      .select("key, match(id, home_team_id, away_team_id, match_result(winner_team_id))")
      .eq("tournament_id", tournamentId)
      .in("key", ["championship", "third_place"]),
    getTournamentTeamDisplays(tournamentId),
  ]);

  function resolveStage(key: string): { winnerId: string | null; loserId: string | null } {
    const stage = (finalStages ?? []).find((s) => s.key === key);
    const match = stage?.match?.[0];
    if (!match) return { winnerId: null, loserId: null };
    const result = Array.isArray(match.match_result) ? match.match_result[0] : match.match_result;
    const winnerId = result?.winner_team_id ?? null;
    if (!winnerId) return { winnerId: null, loserId: null };
    const loserId = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;
    return { winnerId, loserId };
  }

  const champ = resolveStage("championship");
  const third = resolveStage("third_place");
  const display = (id: string | null) => (id ? teamDisplayById.get(id) ?? null : null);

  return {
    champion: display(champ.winnerId),
    firstRunnerUp: display(champ.loserId),
    secondRunnerUp: display(third.winnerId),
    thirdRunnerUp: display(third.loserId),
    standings,
    allMatches,
  };
}
