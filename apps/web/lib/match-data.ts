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
  stageKey?: string;
  stageMatchIndex?: number;
  stageTotalMatches?: number;
  matchLabel?: string;
  fullBadgeText?: string;
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
  courtId: string | null;
  /** Position in that court's queue; round N+1 is what players see. */
  round: number | null;
};

const TBD: TeamDisplay = { header: "TBD", subtext: null };
const BYE: TeamDisplay = { header: "Bye", subtext: null };

const RESOLVED = ["completed", "forfeit", "bye"];

function formatCleanStageLabel(opts: {
  stageKey?: string;
  stageName: string;
  groupName: string | null;
  stageMatchIndex: number;
  stageTotalMatches: number;
}): { cleanStageName: string; matchLabel: string } {
  const k = (opts.stageKey ?? "").toLowerCase();
  const n = opts.stageName.toLowerCase();

  if (k.includes("quarter") || n.includes("quarter")) {
    const cleanStageName = "Quarterfinals";
    const matchLabel = opts.stageTotalMatches > 1
      ? `Quarterfinals (Match ${opts.stageMatchIndex} of ${opts.stageTotalMatches})`
      : "Quarterfinals";
    return { cleanStageName, matchLabel };
  }
  if (k.includes("semi") || n.includes("semi")) {
    const cleanStageName = "Semifinals";
    const matchLabel = opts.stageTotalMatches > 1
      ? `Semifinals (Match ${opts.stageMatchIndex} of ${opts.stageTotalMatches})`
      : "Semifinals";
    return { cleanStageName, matchLabel };
  }
  if (k.includes("third") || n.includes("third")) {
    return { cleanStageName: "Fight for Third", matchLabel: "Fight for Third" };
  }
  if (k.includes("champ") || n.includes("champ") || n.includes("final")) {
    return { cleanStageName: "Championship", matchLabel: "Championship" };
  }
  if (k.includes("16") || n.includes("16")) {
    const cleanStageName = "Round of 16";
    const matchLabel = opts.stageTotalMatches > 1
      ? `Round of 16 (Match ${opts.stageMatchIndex} of ${opts.stageTotalMatches})`
      : "Round of 16";
    return { cleanStageName, matchLabel };
  }

  // Pool stage / round-robin
  if (opts.groupName) {
    const cleanGroup = opts.groupName.replace(/^(Bracket|Pool|Group)\s*/i, "").trim();
    const cleanPool = cleanGroup ? `Pool ${cleanGroup}` : opts.groupName;
    return { cleanStageName: "Pool Stage", matchLabel: cleanPool };
  }

  const cleanStageName = opts.stageName.replace(/Bracket/gi, "").trim() || "Pool Stage";
  return { cleanStageName, matchLabel: cleanStageName };
}

/**
 * Every match in a tournament with its result folded in.
 * Matches are ordered chronologically by stage sequence and group order,
 * with continuous match numbers (1 to N) from round-robin all the way up to finals.
 */
const getAllMatchRows = cache(async (tournamentId: string): Promise<MatchListRow[]> => {
  const supabase = getServiceSupabase();

  const [{ data: matches, error }, { data: stages }, { data: groups }, teamDisplayById] = await Promise.all([
    supabase
      .from("match")
      .select(
        "id, match_number, status, stage_id, group_id, home_team_id, away_team_id, display_order, court_id, court(name), match_result(winner_team_id, home_games_won, away_games_won, home_points_total, away_points_total, result_type)",
      )
      .eq("tournament_id", tournamentId),
    supabase.from("stage").select("id, name, key, sequence, format_key").eq("tournament_id", tournamentId).order("sequence"),
    supabase.from("tournament_group").select("id, name, display_order, stage!inner(tournament_id)").eq("stage.tournament_id", tournamentId),
    getTournamentTeamDisplays(tournamentId),
  ]);
  if (error) throw new Error(error.message);

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]));
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

  const playable = (matches ?? []).filter((m) => m.home_team_id);
  const sorted = [...playable].sort((a, b) => {
    const stageA = stageById.get(a.stage_id);
    const stageB = stageById.get(b.stage_id);
    const seqDiff = (stageA?.sequence ?? 0) - (stageB?.sequence ?? 0);
    if (seqDiff !== 0) return seqDiff;

    const grpA = a.group_id ? groupById.get(a.group_id) : undefined;
    const grpB = b.group_id ? groupById.get(b.group_id) : undefined;
    const grpDiff = (grpA?.display_order ?? 0) - (grpB?.display_order ?? 0);
    if (grpDiff !== 0) return grpDiff;

    return a.match_number - b.match_number;
  });

  const stageCounts = new Map<string, number>();
  for (const m of sorted) {
    stageCounts.set(m.stage_id, (stageCounts.get(m.stage_id) ?? 0) + 1);
  }
  const stageCurrentIndex = new Map<string, number>();

  return sorted.map((m, overallIndex) => {
    const result = Array.isArray(m.match_result) ? m.match_result[0] : m.match_result;
    const court = Array.isArray(m.court) ? m.court[0] : m.court;
    const winnerId = result?.winner_team_id ?? null;
    const stage = stageById.get(m.stage_id);
    const group = m.group_id ? groupById.get(m.group_id) : undefined;

    const continuousMatchNumber = overallIndex + 1;
    const curIdx = (stageCurrentIndex.get(m.stage_id) ?? 0) + 1;
    stageCurrentIndex.set(m.stage_id, curIdx);
    const totalInStage = stageCounts.get(m.stage_id) ?? 1;

    const { cleanStageName, matchLabel } = formatCleanStageLabel({
      stageKey: stage?.key,
      stageName: stage?.name ?? "",
      groupName: group?.name ?? null,
      stageMatchIndex: curIdx,
      stageTotalMatches: totalInStage,
    });

    const fullBadgeText = `M${continuousMatchNumber} · ${matchLabel}`;

    return {
      id: m.id,
      matchNumber: continuousMatchNumber,
      status: m.status,
      stageName: cleanStageName,
      stageKey: stage?.key,
      stageMatchIndex: curIdx,
      stageTotalMatches: totalInStage,
      matchLabel,
      fullBadgeText,
      groupName: group ? (group.name.startsWith("Pool") || group.name.startsWith("Group") ? group.name : `Pool ${group.name.replace(/^Bracket\s*/i, "")}`) : null,
      home: m.home_team_id ? teamDisplayById.get(m.home_team_id) ?? TBD : TBD,
      away: m.away_team_id ? teamDisplayById.get(m.away_team_id) ?? TBD : BYE,
      homeGamesWon: result?.home_games_won ?? null,
      awayGamesWon: result?.away_games_won ?? null,
      homePointsTotal: result?.home_points_total ?? null,
      awayPointsTotal: result?.away_points_total ?? null,
      resultType: result?.result_type ?? null,
      winnerSide: winnerId ? (winnerId === m.home_team_id ? "home" : "away") : null,
      courtName: court?.name ?? null,
      courtId: m.court_id ?? null,
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

export type CourtOption = { id: string; name: string; isAvailable: boolean };

/** Courts a match can be sent to, for the court picker on the Mark-live button. */
export const getTournamentCourts = cache(async (tournamentId: string): Promise<CourtOption[]> => {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("court")
    .select("id, name, is_available")
    .eq("tournament_id", tournamentId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, isAvailable: c.is_available }));
});

export type MatchDetail = {
  id: string;
  matchNumber: number;
  status: string;
  stageName: string;
  stageKey?: string;
  matchLabel?: string;
  fullBadgeText?: string;
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
      "id, tournament_id, match_number, status, stage_id, group_id, home_team_id, away_team_id, scoring_config, stage(name, key), tournament_group(name), game(game_number, home_score, away_score), match_result(result_type, recorded_by, recorded_at)",
    )
    .eq("id", matchId)
    .single();
  if (!match || !match.home_team_id || !match.away_team_id) return null;

  const teamDisplayById = await getTeamDisplayMap([match.home_team_id, match.away_team_id]);
  const stage = Array.isArray(match.stage) ? match.stage[0] : match.stage;
  const group = Array.isArray(match.tournament_group) ? match.tournament_group[0] : match.tournament_group;
  const result = Array.isArray(match.match_result) ? match.match_result[0] : match.match_result;

  const allRows = await getAllMatchRows(match.tournament_id);
  const matchingRow = allRows.find((r) => r.id === match.id);

  return {
    id: match.id,
    matchNumber: matchingRow?.matchNumber ?? match.match_number,
    status: match.status,
    stageName: matchingRow?.stageName ?? (stage?.name ?? ""),
    stageKey: matchingRow?.stageKey ?? stage?.key,
    matchLabel: matchingRow?.matchLabel,
    fullBadgeText: matchingRow?.fullBadgeText,
    groupName: matchingRow?.groupName ?? (group?.name ?? null),
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
