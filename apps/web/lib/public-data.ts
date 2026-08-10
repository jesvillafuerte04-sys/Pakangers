import "server-only";
import { getServiceSupabase } from "./supabase-server";
import { getMatchList, type MatchListRow } from "./match-data";
import { getDisplayStandings, type DisplayStandingsGroup } from "./match-pipeline";
import { getTeamDisplayMap, type TeamDisplay } from "./team-display";

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
  standingsSnippet: { stageName: string; groupName: string; topTeam: TeamDisplay; topTeamRecord: string }[];
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
      return { stageName: g.stageName, groupName: g.groupName, topTeam: top.team, topTeamRecord: `${top.wins}-${top.losses}` };
    });

  return { live, upcoming: upcoming.slice(0, 3), standingsSnippet };
}

export type FinalResults = {
  champion: TeamDisplay | null;
  runnerUp: TeamDisplay | null;
  thirdPlace: TeamDisplay | null;
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
  const [{ data: tournament }, { data: stages }, { data: rules }] = await Promise.all([
    supabase.from("tournament").select("rule_set_id").eq("id", tournamentId).single(),
    supabase.from("stage").select("name, sequence, scoring_config").eq("tournament_id", tournamentId).order("sequence"),
    supabase
      .from("tournament_rule")
      .select("category, title, summary_text, display_order")
      .or(`tournament_id.eq.${tournamentId},tournament_id.is.null`)
      .order("display_order"),
  ]);

  const { data: ruleSetRow } = tournament?.rule_set_id
    ? await supabase.from("rule_set").select("name, governing_body, edition_year, source_url").eq("id", tournament.rule_set_id).single()
    : { data: null };

  return {
    scoringByStage: (stages ?? []).map((s) => {
      const cfg = s.scoring_config as unknown as { pointsToWin: number; winBy: string; bestOf: number; cap?: number };
      return { stageName: s.name, pointsToWin: cfg.pointsToWin, winBy: cfg.winBy, bestOf: cfg.bestOf, cap: cfg.cap ?? null };
    }),
    ruleSet: ruleSetRow
      ? { name: ruleSetRow.name, governingBody: ruleSetRow.governing_body, editionYear: ruleSetRow.edition_year, sourceUrl: ruleSetRow.source_url }
      : null,
    tournamentRules: (rules ?? []).map((r) => ({ category: r.category, title: r.title, summaryText: r.summary_text })),
  };
}

export async function getFinalResults(tournamentId: string): Promise<FinalResults> {
  const supabase = getServiceSupabase();
  const [standings, allMatches, { data: stages }] = await Promise.all([
    getDisplayStandings(tournamentId),
    getMatchList(tournamentId, "all"),
    supabase.from("stage").select("id, key").eq("tournament_id", tournamentId).in("key", ["championship", "third_place"]),
  ]);

  const stageIdByKey = new Map((stages ?? []).map((s) => [s.key, s.id]));
  const stageIds = [...stageIdByKey.values()];
  const { data: finalMatches } = stageIds.length
    ? await supabase.from("match").select("id, stage_id, home_team_id, away_team_id").in("stage_id", stageIds)
    : { data: [] as { id: string; stage_id: string; home_team_id: string | null; away_team_id: string | null }[] };

  const matchIds = (finalMatches ?? []).map((m) => m.id);
  const { data: results } = matchIds.length
    ? await supabase.from("match_result").select("match_id, winner_team_id").in("match_id", matchIds)
    : { data: [] as { match_id: string; winner_team_id: string | null }[] };
  const resultByMatchId = new Map((results ?? []).map((r) => [r.match_id, r]));

  function resolveStage(key: string): { winnerId: string | null; loserId: string | null } {
    const stageId = stageIdByKey.get(key);
    const match = (finalMatches ?? []).find((m) => m.stage_id === stageId);
    if (!match) return { winnerId: null, loserId: null };
    const winnerId = resultByMatchId.get(match.id)?.winner_team_id ?? null;
    if (!winnerId) return { winnerId: null, loserId: null };
    const loserId = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;
    return { winnerId, loserId };
  }

  const champ = resolveStage("championship");
  const third = resolveStage("third_place");
  const teamDisplayById = await getTeamDisplayMap(
    [champ.winnerId, champ.loserId, third.winnerId].filter((id): id is string => Boolean(id)),
  );

  return {
    champion: champ.winnerId ? teamDisplayById.get(champ.winnerId) ?? null : null,
    runnerUp: champ.loserId ? teamDisplayById.get(champ.loserId) ?? null : null,
    thirdPlace: third.winnerId ? teamDisplayById.get(third.winnerId) ?? null : null,
    standings,
    allMatches,
  };
}
