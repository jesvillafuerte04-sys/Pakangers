import "server-only";
import { cache } from "react";
import { getServiceSupabase } from "./supabase-server";
import type { ScoringConfig } from "@pakangers/engine";
import { getTeamDisplayMap, getTournamentTeamDisplays, type TeamDisplay } from "./team-display";

export type MatchListFilter = "live" | "upcoming" | "completed" | "all";

export type MatchListRow = {
  id: string;
  matchNumber: number;
  status: string;
  stageName: string;
  groupName: string | null;
  home: TeamDisplay;
  away: TeamDisplay;
  homeGamesWon: number | null;
  awayGamesWon: number | null;
  homePointsTotal: number | null;
  awayPointsTotal: number | null;
  resultType: string | null;
  /** Which side won, once a result exists -- drives winner/loser emphasis in the UI. */
  winnerSide: "home" | "away" | null;
  courtName: string | null;
  /** Position in that court's queue; round N+1 is what players see. */
  round: number | null;
};

const TBD: TeamDisplay = { header: "TBD", subtext: null };
const BYE: TeamDisplay = { header: "Bye", subtext: null };

const RESOLVED = ["completed", "forfeit", "bye"];

/**
 * Every match in a tournament with its result folded in. Four parallel,
 * tournament-scoped round trips -- note the group query filters through
 * stage!inner rather than reading the whole tournament_group table.
 */
const getAllMatchRows = cache(async (tournamentId: string): Promise<MatchListRow[]> => {
  const supabase = getServiceSupabase();

  const [{ data: matches, error }, { data: stages }, { data: groups }, teamDisplayById] = await Promise.all([
    supabase
      .from("match")
      .select(
        "id, match_number, status, stage_id, group_id, home_team_id, away_team_id, display_order, court(name), match_result(winner_team_id, home_games_won, away_games_won, home_points_total, away_points_total, result_type)",
      )
      .eq("tournament_id", tournamentId)
      .order("match_number"),
    supabase.from("stage").select("id, name").eq("tournament_id", tournamentId),
    supabase.from("tournament_group").select("id, name, stage!inner(tournament_id)").eq("stage.tournament_id", tournamentId),
    getTournamentTeamDisplays(tournamentId),
  ]);
  if (error) throw new Error(error.message);

  const stageNameById = new Map((stages ?? []).map((s) => [s.id, s.name]));
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return (matches ?? [])
    .filter((m) => m.home_team_id) // the pipeline only creates a row once the home slot resolves (away is null only for a bye)
    .map((m) => {
      // match_result is one-to-one, but the nested select types it as an array.
      const result = Array.isArray(m.match_result) ? m.match_result[0] : m.match_result;
      const court = Array.isArray(m.court) ? m.court[0] : m.court;
      const winnerId = result?.winner_team_id ?? null;
      return {
        id: m.id,
        matchNumber: m.match_number,
        status: m.status,
        stageName: stageNameById.get(m.stage_id) ?? "",
        groupName: m.group_id ? groupNameById.get(m.group_id) ?? null : null,
        home: m.home_team_id ? teamDisplayById.get(m.home_team_id) ?? TBD : TBD,
        away: m.away_team_id ? teamDisplayById.get(m.away_team_id) ?? TBD : BYE,
        homeGamesWon: result?.home_games_won ?? null,
        awayGamesWon: result?.away_games_won ?? null,
        homePointsTotal: result?.home_points_total ?? null,
        awayPointsTotal: result?.away_points_total ?? null,
        resultType: result?.result_type ?? null,
        winnerSide: winnerId ? (winnerId === m.home_team_id ? "home" : "away") : null,
        courtName: court?.name ?? null,
        round: m.display_order,
      };
    });
});

export async function getMatchList(tournamentId: string, filter: MatchListFilter = "upcoming"): Promise<MatchListRow[]> {
  const rows = await getAllMatchRows(tournamentId);
  if (filter === "all") return rows;
  if (filter === "completed") return rows.filter((r) => RESOLVED.includes(r.status));
  if (filter === "live") return rows.filter((r) => r.status === "in_progress");
  return rows.filter((r) => r.status === "pending" || r.status === "scheduled");
}

export type MatchDetail = {
  id: string;
  matchNumber: number;
  status: string;
  stageName: string;
  groupName: string | null;
  homeTeamId: string;
  awayTeamId: string;
  home: TeamDisplay;
  away: TeamDisplay;
  scoringConfig: ScoringConfig;
  existingGames: { gameNumber: number; homeScore: number; awayScore: number }[];
  priorResult: { resultType: string; recordedBy: string; recordedAt: string } | null;
};

export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  const supabase = getServiceSupabase();
  const { data: match } = await supabase
    .from("match")
    .select(
      "id, match_number, status, stage_id, group_id, home_team_id, away_team_id, scoring_config, stage(name), tournament_group(name), game(game_number, home_score, away_score), match_result(result_type, recorded_by, recorded_at)",
    )
    .eq("id", matchId)
    .single();
  if (!match || !match.home_team_id || !match.away_team_id) return null;

  const teamDisplayById = await getTeamDisplayMap([match.home_team_id, match.away_team_id]);
  const stage = Array.isArray(match.stage) ? match.stage[0] : match.stage;
  const group = Array.isArray(match.tournament_group) ? match.tournament_group[0] : match.tournament_group;
  const result = Array.isArray(match.match_result) ? match.match_result[0] : match.match_result;

  return {
    id: match.id,
    matchNumber: match.match_number,
    status: match.status,
    stageName: stage?.name ?? "",
    groupName: group?.name ?? null,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    home: teamDisplayById.get(match.home_team_id) ?? TBD,
    away: teamDisplayById.get(match.away_team_id) ?? TBD,
    scoringConfig: match.scoring_config as unknown as MatchDetail["scoringConfig"],
    existingGames: (match.game ?? [])
      .map((g) => ({ gameNumber: g.game_number, homeScore: g.home_score, awayScore: g.away_score }))
      .sort((a, b) => a.gameNumber - b.gameNumber),
    priorResult: result ? { resultType: result.result_type, recordedBy: result.recorded_by, recordedAt: result.recorded_at } : null,
  };
}

export async function getMatchProgress(tournamentId: string): Promise<{ completed: number; total: number }> {
  const rows = await getAllMatchRows(tournamentId);
  return { completed: rows.filter((r) => RESOLVED.includes(r.status)).length, total: rows.length };
}
