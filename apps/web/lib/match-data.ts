import "server-only";
import { cache } from "react";
import { getServiceSupabase } from "./supabase-server";
import type { ScoringConfig } from "@pakangers/engine";
import { getTeamDisplayMap, getTournamentTeamDisplays, type TeamDisplay } from "./team-display";
import { continuousMatchNumbers, courtLabel, slotSourceLabel, stageLabel, type SlotSource } from "./match-identity";

export type MatchListFilter = "live" | "upcoming" | "completed" | "all";

export type MatchListRow = {
  /** False while a knockout slot is still waiting on a feeder. */
  isReadyToPlay: boolean;
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
  /** Why an awarded match was awarded, as typed by the scorer. */
  resultNote: string | null;
  /** When the result was recorded, for ordering the completed list. */
  recordedAt: string | null;
  /** Which side won, once a result exists -- drives winner/loser emphasis in the UI. */
  winnerSide: "home" | "away" | null;
  courtName: string | null;
  /** Always renders: the court name, or "Court TBA" when none is assigned. */
  courtLabel: string;
  courtId: string | null;
  /** Position in that court's queue; round N+1 is what players see. */
  round: number | null;
};

const TBD: TeamDisplay = { header: "TBD", subtext: null };
const BYE: TeamDisplay = { header: "Bye", subtext: null };

const RESOLVED = ["completed", "forfeit", "bye"];

/**
 * Every match in a tournament with its result folded in.
 * Matches are ordered chronologically by stage sequence and group order,
 * with continuous match numbers (1 to N) from round-robin all the way up to finals.
 */
const getAllMatchRows = cache(async (tournamentId: string): Promise<MatchListRow[]> => {
  const supabase = getServiceSupabase();

  const [{ data: matches, error }, { data: stages }, { data: groups }, { data: teamRows }, { data: nodeRows }, { count: openCourts }, teamDisplayById] =
    await Promise.all([
      supabase
        .from("match")
        .select(
          "id, match_number, status, stage_id, group_id, home_team_id, away_team_id, display_order, court_id, court(name), match_result(winner_team_id, home_games_won, away_games_won, home_points_total, away_points_total, result_type, result_note, recorded_at)",
        )
        .eq("tournament_id", tournamentId),
      supabase.from("stage").select("id, name, key, sequence, format_key").eq("tournament_id", tournamentId).order("sequence"),
      supabase.from("tournament_group").select("id, name, display_order, stage!inner(tournament_id)").eq("stage.tournament_id", tournamentId),
    supabase.from("team").select("id, group_id").eq("tournament_id", tournamentId),
    // What each knockout slot is waiting on, so an unfilled side can say so.
    supabase
      .from("bracket_node")
      .select("stage_id, position, home_ref, away_ref, stage!inner(tournament_id)")
      .eq("stage.tournament_id", tournamentId),
      // How many brackets can run at once, which is what makes the match
      // numbers follow the order the matches are actually called.
      supabase
        .from("court")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .eq("is_available", true),
      getTournamentTeamDisplays(tournamentId),
    ]);
  if (error) throw new Error(error.message);

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]));
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  // A bracket match should name its bracket even when the column was not
  // stamped -- the teams themselves say which bracket they are in.
  const groupIdByTeamId = new Map((teamRows ?? []).filter((t) => t.group_id).map((t) => [t.id, t.group_id!]));
  const nodeByStageAndNumber = new Map(
    (nodeRows ?? []).map((n) => [`${n.stage_id}:${n.position}`, n]),
  );
  // Knockout matches have no bracket, whatever pool their teams came from.
  const bracketOf = (m: { stage_id: string; group_id: string | null; home_team_id: string | null; away_team_id: string | null }) =>
    stageById.get(m.stage_id)?.format_key === "single_elimination"
      ? null
      : m.group_id
        ?? (m.home_team_id ? groupIdByTeamId.get(m.home_team_id) : null)
        ?? (m.away_team_id ? groupIdByTeamId.get(m.away_team_id) : null)
        ?? null;

  const ctx = {
    stageSequenceById: new Map((stages ?? []).map((s) => [s.id, s.sequence])),
    groupOrderById: new Map((groups ?? []).map((g) => [g.id, g.display_order])),
    bracketsPerBatch: openCourts ?? undefined,
  };
  // Every match is numbered, TBD knockout slots included, so a number assigned
  // before the event is still that match's number once the bracket resolves.
  const numberById = continuousMatchNumbers(
    (matches ?? []).map((m) => ({ id: m.id, stageId: m.stage_id, groupId: bracketOf(m), matchNumber: m.match_number })),
    ctx,
  );

  // At least one side known is enough to show the match: the other side
  // renders as the slot it is waiting on. Testing home alone hid any match
  // whose away feeder happened to finish first.
  const playable = (matches ?? []).filter((m) => m.home_team_id || m.away_team_id);
  const sorted = [...playable].sort((a, b) => (numberById.get(a.id) ?? 0) - (numberById.get(b.id) ?? 0));

  const stageCounts = new Map<string, number>();
  for (const m of sorted) {
    stageCounts.set(m.stage_id, (stageCounts.get(m.stage_id) ?? 0) + 1);
  }
  const stageCurrentIndex = new Map<string, number>();

  /**
   * A side with no team: a real bye only when the match says so, otherwise
   * the slot it is still waiting on.
   */
  const emptySide = (m: { stage_id: string; match_number: number; status: string }, side: "home" | "away"): TeamDisplay => {
    if (m.status === "bye") return BYE;
    const node = nodeByStageAndNumber.get(`${m.stage_id}:${m.match_number}`);
    const ref = (side === "home" ? node?.home_ref : node?.away_ref) as SlotSource | undefined;
    return { header: slotSourceLabel(ref), subtext: null };
  };

  return sorted.map((m) => {
    const result = Array.isArray(m.match_result) ? m.match_result[0] : m.match_result;
    const courtRow = Array.isArray(m.court) ? m.court[0] : m.court;
    const winnerId = result?.winner_team_id ?? null;
    const stage = stageById.get(m.stage_id);
    const resolvedGroupId = bracketOf(m);
    const group = resolvedGroupId ? groupById.get(resolvedGroupId) : undefined;

    const continuousMatchNumber = numberById.get(m.id) ?? m.match_number;
    const curIdx = (stageCurrentIndex.get(m.stage_id) ?? 0) + 1;
    stageCurrentIndex.set(m.stage_id, curIdx);
    const totalInStage = stageCounts.get(m.stage_id) ?? 1;

    const label = stageLabel({
      stageKey: stage?.key,
      stageName: stage?.name ?? "",
      groupName: group?.name ?? null,
      groupOrder: group?.display_order ?? null,
    });
    // "Semi-Finals (Match 1 of 2)" only where the stage really has more than one.
    const matchLabel =
      label.bracket === null && totalInStage > 1
        ? `${label.stage} (Match ${curIdx} of ${totalInStage})`
        : label.full;

    const court = courtLabel(courtRow?.name);
    const fullBadgeText = `M${continuousMatchNumber} · ${matchLabel} · ${court}`;

    return {
      id: m.id,
      matchNumber: continuousMatchNumber,
      status: m.status,
      stageName: label.stage,
      stageKey: stage?.key,
      stageMatchIndex: curIdx,
      stageTotalMatches: totalInStage,
      matchLabel,
      fullBadgeText,
      groupName: label.bracket,
      home: m.home_team_id ? teamDisplayById.get(m.home_team_id) ?? TBD : emptySide(m, "home"),
      away: m.away_team_id ? teamDisplayById.get(m.away_team_id) ?? TBD : emptySide(m, "away"),
      homeGamesWon: result?.home_games_won ?? null,
      awayGamesWon: result?.away_games_won ?? null,
      homePointsTotal: result?.home_points_total ?? null,
      awayPointsTotal: result?.away_points_total ?? null,
      resultType: result?.result_type ?? null,
      isReadyToPlay: Boolean(m.home_team_id && m.away_team_id),
      resultNote: result?.result_note ?? null,
      recordedAt: result?.recorded_at ?? null,
      winnerSide: winnerId ? (winnerId === m.home_team_id ? "home" : "away") : null,
      courtName: courtRow?.name ?? null,
      courtLabel: court,
      courtId: m.court_id ?? null,
      round: m.display_order,
    };
  });
});

export async function getMatchList(tournamentId: string, filter: MatchListFilter = "upcoming"): Promise<MatchListRow[]> {
  const rows = await getAllMatchRows(tournamentId);
  if (filter === "all") return rows;
  // Newest first: a scorer or a spectator checking results wants the match
  // that just finished, not the first one of the morning. Ordered by when the
  // result was recorded rather than by match number, because matches are not
  // scored in numerical order -- a later court often finishes first.
  if (filter === "completed") {
    return rows
      .filter((r) => RESOLVED.includes(r.status))
      .sort((a, b) => {
        const at = a.recordedAt ? Date.parse(a.recordedAt) : null;
        const bt = b.recordedAt ? Date.parse(b.recordedAt) : null;
        if (at !== null && bt !== null && at !== bt) return bt - at;
        if (at !== null && bt === null) return -1;
        if (at === null && bt !== null) return 1;
        return b.matchNumber - a.matchNumber;
      });
  }
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
  /** IANA zone the tournament runs in, so times read as local to the venue. */
  timezone: string;
};

export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  const supabase = getServiceSupabase();
  const { data: match } = await supabase
    .from("match")
    .select(
      "id, tournament_id, match_number, status, stage_id, group_id, home_team_id, away_team_id, scoring_config, tournament(timezone), stage(name, key), tournament_group(name), game(game_number, home_score, away_score), match_result(result_type, recorded_by, recorded_at)",
    )
    .eq("id", matchId)
    .single();
  if (!match || !match.home_team_id || !match.away_team_id) return null;

  const teamDisplayById = await getTeamDisplayMap([match.home_team_id, match.away_team_id]);
  const stage = Array.isArray(match.stage) ? match.stage[0] : match.stage;
  const group = Array.isArray(match.tournament_group) ? match.tournament_group[0] : match.tournament_group;
  const result = Array.isArray(match.match_result) ? match.match_result[0] : match.match_result;
  const tournamentRow = Array.isArray(match.tournament) ? match.tournament[0] : match.tournament;

  const allRows = await getAllMatchRows(match.tournament_id);
  const matchingRow = allRows.find((r) => r.id === match.id);

  return {
    id: match.id,
    matchNumber: matchingRow?.matchNumber ?? match.match_number,
    status: match.status,
    stageName: matchingRow?.stageName ?? (stage?.name ?? ""),
    stageKey: matchingRow?.stageKey ?? stage?.key,
    timezone: tournamentRow?.timezone ?? "Asia/Manila",
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
