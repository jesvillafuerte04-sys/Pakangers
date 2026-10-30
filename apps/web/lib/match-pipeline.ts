import "server-only";
import { getServiceSupabase } from "./supabase-server";
import type { Json, Tables, TypedSupabaseClient } from "@pakangers/db";
import {
  getFormat,
  computeStandings as engineComputeStandings,
  resolveSlotRef,
  gameWinner,
  matchWinner,
  type Match as EngineMatch,
  type MatchStatus,
  type MatchSide,
  type Standing,
  type StageConfig,
  type ScoringConfig,
  type Tiebreaker,
  type Entrant,
  type PlannedMatch,
  type PlannedMatchEntrants,
  type ResolutionContext,
  type Game,
} from "@pakangers/engine";
import { getTournamentTeamDisplays, type TeamDisplay } from "./team-display";
import { continuousMatchNumbers, courtLabel, stageLabel } from "./match-identity";

type StageRow = Tables<"stage">;
type GroupRow = Tables<"tournament_group">;
type TeamRow = Tables<"team">;
type MatchRow = Tables<"match">;
type GameRow = Tables<"game">;
type BracketNodeRow = Tables<"bracket_node">;

const RESOLVED_STATUSES: MatchStatus[] = ["completed", "forfeit", "bye"];

type TournamentSnapshot = {
  stages: StageRow[];
  groups: GroupRow[];
  teams: TeamRow[];
  matches: MatchRow[];
  games: GameRow[];
  bracketNodes: BracketNodeRow[];
};

async function loadTournamentSnapshot(
  supabase: TypedSupabaseClient,
  tournamentId: string,
): Promise<TournamentSnapshot> {
  const [stagesRes, teamsRes, matchesRes] = await Promise.all([
    supabase.from("stage").select("*").eq("tournament_id", tournamentId).order("sequence"),
    supabase.from("team").select("*").eq("tournament_id", tournamentId),
    supabase.from("match").select("*").eq("tournament_id", tournamentId),
  ]);
  if (stagesRes.error) throw new Error(stagesRes.error.message);
  if (teamsRes.error) throw new Error(teamsRes.error.message);
  if (matchesRes.error) throw new Error(matchesRes.error.message);

  const stages = stagesRes.data ?? [];
  const teams = teamsRes.data ?? [];
  const matches = matchesRes.data ?? [];
  const stageIds = stages.map((s) => s.id);
  const matchIds = matches.map((m) => m.id);

  const [groupsRes, gamesRes, bracketNodesRes] = await Promise.all([
    stageIds.length
      ? supabase.from("tournament_group").select("*").in("stage_id", stageIds)
      : Promise.resolve({ data: [] as GroupRow[], error: null }),
    matchIds.length
      ? supabase.from("game").select("*").in("match_id", matchIds)
      : Promise.resolve({ data: [] as GameRow[], error: null }),
    stageIds.length
      ? supabase.from("bracket_node").select("*").in("stage_id", stageIds)
      : Promise.resolve({ data: [] as BracketNodeRow[], error: null }),
  ]);
  if (groupsRes.error) throw new Error(groupsRes.error.message);
  if (gamesRes.error) throw new Error(gamesRes.error.message);
  if (bracketNodesRes.error) throw new Error(bracketNodesRes.error.message);

  return {
    stages,
    teams,
    matches,
    groups: groupsRes.data ?? [],
    games: gamesRes.data ?? [],
    bracketNodes: bracketNodesRes.data ?? [],
  };
}

function toEngineGame(g: GameRow): Game {
  return { gameNumber: g.game_number, homeScore: g.home_score, awayScore: g.away_score };
}

function toEngineMatch(
  m: MatchRow,
  allGames: GameRow[],
  groupNameById: Map<string, string>,
  teamGroupIdById?: Map<string, string>,
): EngineMatch {
  let effectiveGroupId = m.group_id;
  if (!effectiveGroupId && teamGroupIdById) {
    effectiveGroupId = (m.home_team_id ? teamGroupIdById.get(m.home_team_id) : null)
      ?? (m.away_team_id ? teamGroupIdById.get(m.away_team_id) : null)
      ?? null;
  }
  return {
    matchNumber: m.match_number,
    round: 0,
    group: effectiveGroupId ? groupNameById.get(effectiveGroupId) : undefined,
    homeEntrantId: m.home_team_id,
    awayEntrantId: m.away_team_id,
    status: m.status as MatchStatus,
    games: allGames
      .filter((g) => g.match_id === m.id)
      .map(toEngineGame)
      .sort((a, b) => a.gameNumber - b.gameNumber),
    scoringConfig: m.scoring_config as unknown as ScoringConfig,
    source: (m.source as "generated" | "manual") ?? "generated",
  };
}

function buildStageConfig(
  stage: StageRow,
  groupsForStage: GroupRow[],
  teamsByGroup: Map<string, string[]>,
): StageConfig {
  const scoring = stage.scoring_config as unknown as ScoringConfig;
  const tiebreakers = ((stage.tiebreaker_config as unknown as Tiebreaker[]) ?? []) as Tiebreaker[];
  const entrantConfig = stage.entrant_config as unknown as { entrants?: PlannedMatchEntrants[] } | null;

  const cfg: StageConfig = { key: stage.key, name: stage.name, formatKey: stage.format_key, scoring, tiebreakers };

  if (entrantConfig?.entrants?.length) {
    cfg.entrants = entrantConfig.entrants;
  } else if (groupsForStage.length > 0) {
    cfg.groups = [...groupsForStage]
      .sort((a, b) => a.display_order - b.display_order)
      .map((g) => ({ name: g.name, entrantIds: teamsByGroup.get(g.id) ?? [] }));
  }
  return cfg;
}

type EngineState = {
  snapshot: TournamentSnapshot;
  ctx: ResolutionContext;
  stageConfigs: Map<string, StageConfig>;
  groupNameById: Map<string, string>;
  groupIdByStageAndName: Map<string, string>;
  teamGroupIdById: Map<string, string>;
  flatEntrants: Entrant[];
  plannedByStageKey: Map<string, PlannedMatch[]>;
};

function buildEngineState(snapshot: TournamentSnapshot): EngineState {
  const groupNameById = new Map(snapshot.groups.map((g) => [g.id, g.name]));
  const groupIdByStageAndName = new Map(snapshot.groups.map((g) => [`${g.stage_id}:${g.name}`, g.id]));
  const teamGroupIdById = new Map(snapshot.teams.filter((t) => t.group_id).map((t) => [t.id, t.group_id!]));

  const teamsByGroup = new Map<string, string[]>();
  for (const t of snapshot.teams) {
    if (!t.group_id) continue;
    const list = teamsByGroup.get(t.group_id) ?? [];
    list.push(t.id);
    teamsByGroup.set(t.group_id, list);
  }

  const stageConfigs = new Map<string, StageConfig>();
  for (const stage of snapshot.stages) {
    const groupsForStage = snapshot.groups.filter((g) => g.stage_id === stage.id);
    stageConfigs.set(stage.key, buildStageConfig(stage, groupsForStage, teamsByGroup));
  }

  const flatEntrants: Entrant[] = snapshot.teams.map((t) => ({
    id: t.id,
    name: t.name,
    seed: t.seed ?? undefined,
  }));

  const engineMatchesByStageId = new Map<string, EngineMatch[]>();
  for (const m of snapshot.matches) {
    const list = engineMatchesByStageId.get(m.stage_id) ?? [];
    list.push(toEngineMatch(m, snapshot.games, groupNameById, teamGroupIdById));
    engineMatchesByStageId.set(m.stage_id, list);
  }

  const plannedByStageKey = new Map<string, PlannedMatch[]>();
  for (const stage of snapshot.stages) {
    const cfg = stageConfigs.get(stage.key)!;
    plannedByStageKey.set(stage.key, getFormat(stage.format_key).generateMatches(cfg, flatEntrants));
  }

  // A group's standings only become meaningful once every one of its planned
  // matches has resolved -- computeStandings always returns *some* rank even
  // at 0 games played (arbitrarily tie-broken), so reporting it early would
  // let a downstream bracket match "resolve" against a made-up order.
  const standingsByGroup = new Map<string, Standing[]>();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  for (const stage of snapshot.stages) {
    const cfg = stageConfigs.get(stage.key)!;
    if (!cfg.groups) continue;
    const planned = plannedByStageKey.get(stage.key)!;
    const stageMatches = engineMatchesByStageId.get(stage.id) ?? [];
    const groupsForStage = snapshot.groups.filter((g) => g.stage_id === stage.id);

    for (const g of cfg.groups) {
      const plannedCount = planned.filter((pm) => pm.group === g.name).length;
      const groupMatches = stageMatches.filter((m) => m.group === g.name);
      const allResolved = plannedCount > 0 && groupMatches.length === plannedCount && groupMatches.every((m) => RESOLVED_STATUSES.includes(m.status));
      if (allResolved) {
        const standings = engineComputeStandings(g.entrantIds, groupMatches, cfg.tiebreakers);
        standingsByGroup.set(g.name, standings);
        const groupRow = groupsForStage.find((gr) => gr.name === g.name);
        const letter = groupRow ? alphabet[groupRow.display_order] : undefined;
        if (letter) {
          standingsByGroup.set(letter, standings);
          standingsByGroup.set(`Bracket ${letter}`, standings);
          standingsByGroup.set(`Pool ${letter}`, standings);
        }
      }
    }
  }

  // Keyed on the real match number only.
  //
  // This used to also alias each match by its position in the array, which
  // silently corrupted the draw: a stage whose matches are created as their
  // feeders resolve does not hold every number, so the 3rd row present could
  // be match 8 -- and writing "round_of_16:3" for it overwrote the real match
  // 3. The quarter final asking for the winner of match 3 then got the winner
  // of match 8, and once a match is written with the wrong teams it is never
  // revisited, so the mistake sticks for the rest of the tournament.
  const matchesByStageAndNumber = new Map<string, EngineMatch>();
  for (const stage of snapshot.stages) {
    for (const m of engineMatchesByStageId.get(stage.id) ?? []) {
      matchesByStageAndNumber.set(`${stage.key}:${m.matchNumber}`, m);
    }
  }

  return {
    snapshot,
    ctx: { standingsByGroup, matchesByStageAndNumber },
    stageConfigs,
    groupNameById,
    groupIdByStageAndName,
    teamGroupIdById,
    flatEntrants,
    plannedByStageKey,
  };
}

type SideResolution = { kind: "team"; id: string } | { kind: "bye" } | { kind: "unresolved" };

function resolveMatchSide(side: MatchSide, ctx: ResolutionContext): SideResolution {
  if (side.kind === "entrant") return { kind: "team", id: side.entrantId };
  if (side.kind === "bye") return { kind: "bye" };
  const resolved = resolveSlotRef(side, ctx);
  return resolved ? { kind: "team", id: resolved } : { kind: "unresolved" };
}

/**
 * The derive -> recompute -> populate pipeline (engine doc, phase 4 of the roadmap).
 * Idempotent and safe to call repeatedly: it never touches a match that already
 * exists, it only creates the ones that have just become resolvable. Called once
 * at "Start tournament" and again after every score save.
 */
export async function populateTournament(tournamentId: string): Promise<void> {
  const supabase = getServiceSupabase();
  const snapshot = await loadTournamentSnapshot(supabase, tournamentId);
  if (snapshot.stages.length === 0) return;

  const state = buildEngineState(snapshot);
  const { ctx, stageConfigs, groupIdByStageAndName, plannedByStageKey } = state;

  const existingByStageAndNumber = new Map<string, MatchRow>();
  for (const m of snapshot.matches) {
    const stage = snapshot.stages.find((s) => s.id === m.stage_id);
    if (stage) existingByStageAndNumber.set(`${stage.key}:${m.match_number}`, m);
  }
  const bracketNodeByKey = new Map<string, BracketNodeRow>();
  for (const n of snapshot.bracketNodes) {
    bracketNodeByKey.set(`${n.stage_id}:${n.round}:${n.position}`, n);
  }

  for (const stage of snapshot.stages) {
    const cfg = stageConfigs.get(stage.key)!;
    const planned = plannedByStageKey.get(stage.key)!;

    for (const pm of planned) {
      const home = resolveMatchSide(pm.home, ctx);
      const away = resolveMatchSide(pm.away, ctx);
      const isBracketStage = stage.format_key === "single_elimination";

      const homeTeamId = home.kind === "team" ? home.id : null;
      const awayTeamId = away.kind === "team" ? away.id : null;
      const bothSettled = home.kind !== "unresolved" && away.kind !== "unresolved";

      // A match already on the board gets the sides that have since become
      // known. Each half of a knockout tie is decided by its own feeder, so a
      // semifinalist takes their place as soon as they win, without waiting
      // for the other quarter final to finish. A side already filled is never
      // rewritten -- it may have been corrected by hand -- and a match that
      // has been played is left alone entirely.
      const already = existingByStageAndNumber.get(`${stage.key}:${pm.matchNumber}`);
      if (already) {
        if (RESOLVED_STATUSES.includes(already.status as MatchStatus) || already.status === "in_progress") continue;

        const patch: { home_team_id?: string; away_team_id?: string; status?: MatchStatus } = {};
        if (!already.home_team_id && homeTeamId) patch.home_team_id = homeTeamId;
        if (!already.away_team_id && awayTeamId) patch.away_team_id = awayTeamId;

        const homeAfter = already.home_team_id ?? patch.home_team_id ?? null;
        const awayAfter = already.away_team_id ?? patch.away_team_id ?? null;
        if (already.status === "pending" && bothSettled && (home.kind === "bye" || away.kind === "bye") && (homeAfter || awayAfter)) {
          patch.status = "bye";
        }

        if (Object.keys(patch).length > 0) {
          const { data: updated, error } = await supabase
            .from("match").update(patch).eq("id", already.id).select("*").single();
          if (error) throw new Error(error.message);
          if (updated) {
            existingByStageAndNumber.set(`${stage.key}:${pm.matchNumber}`, updated);
            ctx.matchesByStageAndNumber.set(`${stage.key}:${pm.matchNumber}`, toEngineMatch(updated, [], new Map()));
          }
        }
        continue;
      }

      // Nothing known about either side yet: record the shape of the draw and
      // wait. A bye still counts as settled, so it is not "nothing known".
      if (!homeTeamId && !awayTeamId && !bothSettled) {
        if (isBracketStage) await ensureBracketNode(supabase, stage.id, pm, bracketNodeByKey, null);
        continue;
      }
      const groupId = (pm.group ? groupIdByStageAndName.get(`${stage.id}:${pm.group}`) : null)
        ?? (homeTeamId ? state.teamGroupIdById.get(homeTeamId) : null)
        ?? (awayTeamId ? state.teamGroupIdById.get(awayTeamId) : null)
        ?? null;
      const status: MatchStatus = bothSettled && (home.kind === "bye" || away.kind === "bye") ? "bye" : "pending";

      const { data: inserted, error } = await supabase
        .from("match")
        .insert({
          tournament_id: tournamentId,
          stage_id: stage.id,
          group_id: groupId,
          match_number: pm.matchNumber,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          status,
          scoring_config: cfg.scoring as unknown as Json,
          source: "generated",
        })
        .select("*")
        .single();
      if (error || !inserted) throw new Error(error?.message ?? "Failed to create match");

      existingByStageAndNumber.set(`${stage.key}:${pm.matchNumber}`, inserted);
      ctx.matchesByStageAndNumber.set(
        `${stage.key}:${pm.matchNumber}`,
        toEngineMatch(inserted, [], new Map()),
      );

      if (isBracketStage) await ensureBracketNode(supabase, stage.id, pm, bracketNodeByKey, inserted.id);
    }
  }

  let allStagesComplete = snapshot.stages.length > 0;
  for (const stage of snapshot.stages) {
    const plannedCount = plannedByStageKey.get(stage.key)?.length ?? 0;
    const stageMatches = [...ctx.matchesByStageAndNumber.entries()]
      .filter(([k]) => k.startsWith(`${stage.key}:`))
      .map(([, m]) => m);

    let status: string;
    if (plannedCount === 0 || stageMatches.length === 0) {
      status = "pending";
    } else if (stageMatches.length === plannedCount && stageMatches.every((m) => RESOLVED_STATUSES.includes(m.status))) {
      status = "completed";
    } else {
      status = "in_progress";
    }
    if (status !== "completed") allStagesComplete = false;

    if (status !== stage.status) {
      const { error } = await supabase.from("stage").update({ status }).eq("id", stage.id);
      if (error) throw new Error(error.message);
    }
  }

  // The tournament itself is complete once every one of its stages is -- this is what
  // switches the public page from the live "Now" view to the P6 podium/final-results view.
  if (allStagesComplete) {
    const { data: tournamentRow } = await supabase.from("tournament").select("status").eq("id", tournamentId).single();
    if (tournamentRow && tournamentRow.status === "in_progress") {
      const { error } = await supabase.from("tournament").update({ status: "completed" }).eq("id", tournamentId);
      if (error) throw new Error(error.message);
    }
  }
}

async function ensureBracketNode(
  supabase: TypedSupabaseClient,
  stageId: string,
  pm: PlannedMatch,
  existingNodes: Map<string, BracketNodeRow>,
  matchId: string | null,
): Promise<void> {
  const key = `${stageId}:${pm.round}:${pm.matchNumber}`;
  const existing = existingNodes.get(key);
  if (existing) {
    const homeDiff = JSON.stringify(existing.home_ref) !== JSON.stringify(pm.home);
    const awayDiff = JSON.stringify(existing.away_ref) !== JSON.stringify(pm.away);
    const matchDiff = Boolean(matchId && !existing.match_id);
    if (homeDiff || awayDiff || matchDiff) {
      const nextMatchId = matchId ?? existing.match_id;
      const { error } = await supabase
        .from("bracket_node")
        .update({
          match_id: nextMatchId,
          home_ref: pm.home as unknown as Json,
          away_ref: pm.away as unknown as Json,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      existingNodes.set(key, {
        ...existing,
        match_id: nextMatchId,
        home_ref: pm.home as unknown as Json,
        away_ref: pm.away as unknown as Json,
      });
    }
    return;
  }

  const { data, error } = await supabase
    .from("bracket_node")
    .insert({
      stage_id: stageId,
      round: pm.round,
      position: pm.matchNumber,
      home_ref: pm.home as unknown as Json,
      away_ref: pm.away as unknown as Json,
      match_id: matchId,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create bracket node");
  existingNodes.set(key, data);
}

export type AffectedDownstreamMatch = {
  matchId: string;
  matchNumber: number;
  stageName: string;
  before: { home: string | null; away: string | null };
  after: { home: string | null; away: string | null };
};

/**
 * Engine doc §8. Simulates the proposed edit in memory and compares every
 * already-created bracket match's resolved entrants before vs after. Never
 * writes anything -- purely a dry run the UI uses to decide whether to show
 * the invalidation confirmation dialog.
 */
export async function checkDownstreamInvalidation(
  tournamentId: string,
  matchId: string,
  proposedGames: Game[],
): Promise<AffectedDownstreamMatch[]> {
  const supabase = getServiceSupabase();
  const snapshot = await loadTournamentSnapshot(supabase, tournamentId);

  const before = buildEngineState(snapshot);

  const hypotheticalGames = snapshot.games.filter((g) => g.match_id !== matchId);
  const targetMatch = snapshot.matches.find((m) => m.id === matchId);
  const nextGameNumberBase = 0;
  const syntheticGameRows: GameRow[] = proposedGames.map((g, i) => ({
    id: `hypothetical-${i}`,
    match_id: matchId,
    game_number: nextGameNumberBase + i + 1,
    home_score: g.homeScore,
    away_score: g.awayScore,
    created_at: new Date().toISOString(),
  }));
  const hypotheticalSnapshot: TournamentSnapshot = {
    ...snapshot,
    games: [...hypotheticalGames, ...syntheticGameRows],
    matches: snapshot.matches.map((m) => (m.id === matchId ? { ...m, status: "completed" } : m)),
  };
  const after = buildEngineState(hypotheticalSnapshot);

  const teamNameById = new Map(snapshot.teams.map((t) => [t.id, t.name]));
  const stageNameById = new Map(snapshot.stages.map((s) => [s.id, s.name]));

  const affected: AffectedDownstreamMatch[] = [];
  for (const node of snapshot.bracketNodes) {
    if (!node.match_id) continue;
    const match = snapshot.matches.find((m) => m.id === node.match_id);
    if (!match || match.id === matchId) continue;

    const beforeHome = resolveMatchSide(node.home_ref as unknown as MatchSide, before.ctx);
    const beforeAway = resolveMatchSide(node.away_ref as unknown as MatchSide, before.ctx);
    const afterHome = resolveMatchSide(node.home_ref as unknown as MatchSide, after.ctx);
    const afterAway = resolveMatchSide(node.away_ref as unknown as MatchSide, after.ctx);

    const idOf = (r: SideResolution): string | null => (r.kind === "team" ? r.id : null);
    const changed = idOf(beforeHome) !== idOf(afterHome) || idOf(beforeAway) !== idOf(afterAway);
    if (!changed) continue;

    affected.push({
      matchId: match.id,
      matchNumber: match.match_number,
      stageName: stageNameById.get(match.stage_id) ?? "Unknown stage",
      before: { home: idOf(beforeHome) && (teamNameById.get(idOf(beforeHome)!) ?? null), away: idOf(beforeAway) && (teamNameById.get(idOf(beforeAway)!) ?? null) },
      after: { home: idOf(afterHome) && (teamNameById.get(idOf(afterHome)!) ?? null), away: idOf(afterAway) && (teamNameById.get(idOf(afterAway)!) ?? null) },
    });
  }
  void targetMatch;
  return affected;
}

export type ResultType = "normal" | "forfeit" | "default" | "retired";

/**
 * Writes a match's result: replaces its games, writes (or replaces) its
 * match_result row, marks the match complete/forfeit, writes the audit log
 * entry, then runs populateTournament() so any now-resolvable downstream
 * matches get created.
 */
export async function writeMatchResult(params: {
  tournamentId: string;
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  games: Game[];
  winnerTeamId: string;
  resultType: ResultType;
  /** Why the match was awarded, when it was not played out. */
  resultNote?: string | null;
  actorName: string;
}): Promise<void> {
  const { tournamentId, matchId, homeTeamId, awayTeamId, games, winnerTeamId, resultType, resultNote, actorName } = params;
  const supabase = getServiceSupabase();

  // Two sequential round trips (fetch, then the games delete that must precede
  // the games insert), then everything independent runs together -- cuts this
  // from ~7 sequential round trips to 3 before populateTournament's own reads.
  const [{ data: priorResult }, { data: priorGames }] = await Promise.all([
    supabase.from("match_result").select("*").eq("match_id", matchId).maybeSingle(),
    supabase.from("game").select("*").eq("match_id", matchId).order("game_number"),
  ]);

  const { error: deleteGamesError } = await supabase.from("game").delete().eq("match_id", matchId);
  if (deleteGamesError) throw new Error(deleteGamesError.message);

  let homeGamesWon = 0;
  let awayGamesWon = 0;
  let homePointsTotal = 0;
  let awayPointsTotal = 0;
  for (const g of games) {
    homePointsTotal += g.homeScore;
    awayPointsTotal += g.awayScore;
    const w = gameWinner(g);
    if (w === "home") homeGamesWon++;
    else if (w === "away") awayGamesWon++;
  }

  const [insertGames, upsertResult, updateMatch, insertAudit] = await Promise.all([
    games.length > 0
      ? supabase.from("game").insert(games.map((g) => ({ match_id: matchId, game_number: g.gameNumber, home_score: g.homeScore, away_score: g.awayScore })))
      : Promise.resolve({ error: null }),
    supabase.from("match_result").upsert(
      {
        match_id: matchId,
        winner_team_id: winnerTeamId,
        home_games_won: homeGamesWon,
        away_games_won: awayGamesWon,
        home_points_total: homePointsTotal,
        away_points_total: awayPointsTotal,
        result_type: resultType,
        result_note: resultNote?.trim() || null,
        recorded_by: actorName,
      },
      { onConflict: "match_id" },
    ),
    supabase.from("match").update({ status: resultType === "normal" ? "completed" : "forfeit" }).eq("id", matchId),
    supabase.from("audit_log").insert({
      tournament_id: tournamentId,
      entity_type: "match",
      entity_id: matchId,
      action: priorResult ? "score_edited" : "score_recorded",
      before: priorResult ? ({ result: priorResult, games: priorGames ?? [] } as unknown as Json) : null,
      after: ({
        result: { winnerTeamId, homeTeamId, awayTeamId, homeGamesWon, awayGamesWon, homePointsTotal, awayPointsTotal, resultType },
        games,
      } as unknown as Json),
      actor_name: actorName,
    }),
  ]);
  if (insertGames.error) throw new Error(insertGames.error.message);
  if (upsertResult.error) throw new Error(upsertResult.error.message);
  if (updateMatch.error) throw new Error(updateMatch.error.message);
  if (insertAudit.error) throw new Error(insertAudit.error.message);

  await populateTournament(tournamentId);
}

export type StandingStat = { k: string; v: string | number };
export type StandingHistoryEntry = { opponent: TeamDisplay; score: string; isWin: boolean };

export type DisplayStandingsGroup = {
  stageKey: string;
  stageName: string;
  groupName: string;
  tiebreakers: Tiebreaker[];
  qualifyCount: number | null;
  /**
   * Every match in this bracket has a result. The top-N highlight waits for
   * this, because a team leading at the halfway point has not qualified yet.
   */
  isComplete: boolean;
  standings: (Standing & {
    team: TeamDisplay;
    /** Short note beside the "Advancing" chip. Null until the bracket is done. */
    advancementReason?: string | null;
    /**
     * The one line in the drill-down: "Advances - won head-to-head vs X" or
     * "Eliminated - behind X on point differential". Null until the bracket
     * is done, because nothing is decided before then.
     */
    outcomeNote?: string | null;
    stats: StandingStat[];
    history: StandingHistoryEntry[];
  })[];
};

/**
 * Computes clear explanation of why an entrant is at their current standing position
 * and why they advance (or why they are placed where they are when there's a tie).
 */
function computeAdvancementAndTieReasons(
  standings: Standing[],
  groupMatches: EngineMatch[],
  qualifyCount: number | null,
  teamDisplayById: Map<string, TeamDisplay>,
): Map<string, { advancementReason: string | null; tiebreakerReason: string | null }> {
  const result = new Map<string, { advancementReason: string | null; tiebreakerReason: string | null }>();

  const hasStarted = standings.some((s) => s.wins > 0 || s.losses > 0 || s.pointsFor > 0);
  if (!hasStarted) {
    for (const s of standings) {
      result.set(s.entrantId, { advancementReason: null, tiebreakerReason: null });
    }
    return result;
  }

  for (let i = 0; i < standings.length; i++) {
    const s = standings[i]!;
    const isQualifying = qualifyCount !== null && i < qualifyCount;
    const tiedWith = standings.filter((o) => o.entrantId !== s.entrantId && o.wins === s.wins);

    if (tiedWith.length === 0) {
      // Outright record
      const advNote = isQualifying ? `Outright ${s.wins}–${s.losses} record` : null;
      result.set(s.entrantId, { advancementReason: advNote, tiebreakerReason: null });
      continue;
    }

    if (tiedWith.length === 1) {
      const other = tiedWith[0]!;
      const isAhead = s.rank < other.rank;
      const otherName = teamDisplayById.get(other.entrantId)?.header ?? "opponent";

      const h2hMatches = groupMatches.filter(
        (m) =>
          RESOLVED_STATUSES.includes(m.status) &&
          ((m.homeEntrantId === s.entrantId && m.awayEntrantId === other.entrantId) ||
            (m.homeEntrantId === other.entrantId && m.awayEntrantId === s.entrantId)),
      );
      let sH2HWins = 0;
      let otherH2HWins = 0;
      for (const m of h2hMatches) {
        const winner = matchWinner(m.scoringConfig, m.games);
        if (winner === "home") {
          if (m.homeEntrantId === s.entrantId) sH2HWins++;
          else otherH2HWins++;
        } else if (winner === "away") {
          if (m.awayEntrantId === s.entrantId) sH2HWins++;
          else otherH2HWins++;
        }
      }

      if (isAhead) {
        if (sH2HWins > otherH2HWins) {
          const reason = `Won head-to-head vs ${otherName}`;
          result.set(s.entrantId, {
            advancementReason: isQualifying ? reason : null,
            tiebreakerReason: reason,
          });
        } else if (s.pointDifferential !== other.pointDifferential) {
          const diffSign = s.pointDifferential >= 0 ? "+" : "";
          const otherDiffSign = other.pointDifferential >= 0 ? "+" : "";
          const reason = `Point differential (${diffSign}${s.pointDifferential} vs ${otherDiffSign}${other.pointDifferential})`;
          result.set(s.entrantId, {
            advancementReason: isQualifying ? `Won tiebreaker on point diff` : null,
            tiebreakerReason: reason,
          });
        } else if (s.pointsFor !== other.pointsFor) {
          const reason = `Points scored (${s.pointsFor} vs ${other.pointsFor} pts)`;
          result.set(s.entrantId, {
            advancementReason: isQualifying ? `Won tiebreaker on points scored` : null,
            tiebreakerReason: reason,
          });
        } else if (s.unresolvedTie) {
          result.set(s.entrantId, {
            advancementReason: isQualifying ? `Tied on every tiebreaker` : null,
            tiebreakerReason: `Tied with ${otherName} on every tiebreaker`,
          });
        } else {
          result.set(s.entrantId, {
            advancementReason: isQualifying ? `Won tiebreaker` : null,
            tiebreakerReason: `Tiebreaker over ${otherName}`,
          });
        }
      } else {
        if (otherH2HWins > sH2HWins) {
          result.set(s.entrantId, {
            advancementReason: null,
            tiebreakerReason: `Behind ${otherName} on head-to-head`,
          });
        } else if (s.pointDifferential !== other.pointDifferential) {
          result.set(s.entrantId, {
            advancementReason: null,
            tiebreakerReason: `Behind ${otherName} on point differential`,
          });
        } else {
          result.set(s.entrantId, {
            advancementReason: null,
            tiebreakerReason: `Tied with ${otherName}`,
          });
        }
      }
    } else {
      // 3-way or multi-way tie
      const minRank = Math.min(s.rank, ...tiedWith.map((o) => o.rank));
      if (s.rank === minRank) {
        if (s.pointDifferential !== tiedWith[0]!.pointDifferential) {
          const diffSign = s.pointDifferential >= 0 ? "+" : "";
          result.set(s.entrantId, {
            advancementReason: isQualifying ? `Won multi-way tiebreaker on point diff (${diffSign}${s.pointDifferential})` : null,
            tiebreakerReason: `Won multi-way tiebreaker on point differential (${diffSign}${s.pointDifferential})`,
          });
        } else {
          result.set(s.entrantId, {
            advancementReason: isQualifying ? `Won multi-way tiebreaker` : null,
            tiebreakerReason: `Won multi-way tiebreaker`,
          });
        }
      } else {
        result.set(s.entrantId, {
          advancementReason: isQualifying ? `Advances via tiebreaker criteria` : null,
          tiebreakerReason: `Tied on ${s.wins} wins (${tiedWith.length + 1}-way tie)`,
        });
      }
    }
  }

  return result;
}

/** Every resolved match a given entrant played within a group, for the standings drill-down. */
function matchHistoryForEntrant(
  entrantId: string,
  groupMatches: EngineMatch[],
  teamDisplayById: Map<string, TeamDisplay>,
): StandingHistoryEntry[] {
  const history: StandingHistoryEntry[] = [];
  for (const m of groupMatches) {
    if (!RESOLVED_STATUSES.includes(m.status)) continue;
    if (m.homeEntrantId !== entrantId && m.awayEntrantId !== entrantId) continue;
    const isHome = m.homeEntrantId === entrantId;
    const opponentId = isHome ? m.awayEntrantId : m.homeEntrantId;
    if (!opponentId) continue; // a bye has no opponent to show

    let myPoints = 0;
    let theirPoints = 0;
    for (const g of m.games) {
      myPoints += isHome ? g.homeScore : g.awayScore;
      theirPoints += isHome ? g.awayScore : g.homeScore;
    }
    const winnerSide = matchWinner(m.scoringConfig, m.games);
    history.push({
      opponent: teamDisplayById.get(opponentId) ?? { header: "Unknown", subtext: null },
      score: `${myPoints}–${theirPoints}`,
      isWin: (winnerSide === "home") === isHome,
    });
  }
  return history;
}

/**
 * Standings for the public/organizer display -- unlike the internal
 * standingsByGroup used by populateTournament, this is never gated on the
 * group being fully resolved. A pool at 0-0 has entirely legitimate
 * standings to show (everyone tied); that's normal mid-event, not something
 * to hide until the last match finishes.
 */
export async function getDisplayStandings(tournamentId: string): Promise<DisplayStandingsGroup[]> {
  const supabase = getServiceSupabase();
  const snapshot = await loadTournamentSnapshot(supabase, tournamentId);
  if (snapshot.stages.length === 0) return [];

  const groupNameById = new Map(snapshot.groups.map((g) => [g.id, g.name]));
  const teamsByGroup = new Map<string, string[]>();
  for (const t of snapshot.teams) {
    if (!t.group_id) continue;
    const list = teamsByGroup.get(t.group_id) ?? [];
    list.push(t.id);
    teamsByGroup.set(t.group_id, list);
  }

  const groupIds = snapshot.groups.map((g) => g.id);
  const [{ data: qualRules }, teamDisplayById] = await Promise.all([
    groupIds.length
      ? supabase.from("qualification_rule").select("from_group_id, method, value").in("from_group_id", groupIds)
      : Promise.resolve({ data: [] as { from_group_id: string | null; method: string; value: number }[] }),
    getTournamentTeamDisplays(tournamentId),
  ]);
  const teamGroupIdById = new Map(snapshot.teams.filter((t) => t.group_id).map((t) => [t.id, t.group_id!]));
  const qualifyCountByGroupId = new Map<string, number>();
  let defaultQualifyCount: number | null = null;
  for (const r of qualRules ?? []) {
    if (r.from_group_id && r.method === "top_n") qualifyCountByGroupId.set(r.from_group_id, r.value);
    if (r.method === "top_n" && typeof r.value === "number" && defaultQualifyCount === null) {
      defaultQualifyCount = r.value;
    }
  }

  const result: DisplayStandingsGroup[] = [];
  for (const stage of snapshot.stages) {
    const groupsForStage = snapshot.groups.filter((g) => g.stage_id === stage.id);
    if (groupsForStage.length === 0) continue;
    const cfg = buildStageConfig(stage, groupsForStage, teamsByGroup);
    if (!cfg.groups) continue;

    const stageMatches = snapshot.matches
      .filter((m) => m.stage_id === stage.id)
      .map((m) => toEngineMatch(m, snapshot.games, groupNameById, teamGroupIdById));

    for (const g of cfg.groups) {
      const groupRow = groupsForStage.find((gr) => gr.name === g.name)!;
      const groupMatches = stageMatches.filter((m) => m.group === g.name);
      const standings = engineComputeStandings(g.entrantIds, groupMatches, cfg.tiebreakers);
      const qCount = qualifyCountByGroupId.get(groupRow.id) ?? defaultQualifyCount;
      const reasonsMap = computeAdvancementAndTieReasons(standings, groupMatches, qCount, teamDisplayById);
      const groupIsComplete =
        groupMatches.length > 0 && groupMatches.every((m) => RESOLVED_STATUSES.includes(m.status));

      result.push({
        stageKey: stage.key,
        stageName: stage.name,
        groupName: g.name,
        tiebreakers: cfg.tiebreakers,
        qualifyCount: qCount,
        isComplete: groupIsComplete,
        standings: standings.map((s, i) => {
          const reasons = reasonsMap.get(s.entrantId);
          // Nothing advances or is eliminated until the bracket is finished,
          // so no reason is shown before then -- a half-played bracket full of
          // "won multi-way tiebreaker" notes reads as though places are settled.
          const qualifies = qCount !== null && i < qCount;
          // Below the line, a tie-break note only explains anything when the
          // tie reached the cut. "Eliminated — won head-to-head vs the team
          // below you" says nothing about why you went out, so 4th and 5th
          // just read "Eliminated". The team one place short still gets its
          // reason, because that tie is the one that kept them out.
          const contestedTheCut = qCount !== null && i === qCount;
          const why = qualifies
            ? reasons?.advancementReason ?? reasons?.tiebreakerReason ?? null
            : contestedTheCut
              ? reasons?.tiebreakerReason ?? null
              : null;
          // "Advances — behind X on head-to-head" reads as a contradiction,
          // so an advancing team that lost a tiebreak is placed, not beaten.
          const verb = qualifies ? (why?.startsWith("Behind") ? `Advances in ${ordinal(i + 1)}` : "Advances") : "Eliminated";
          const outcomeNote =
            !groupIsComplete || qCount === null ? null : `${verb}${why ? ` — ${why.replace(/^Behind/, "behind")}` : ""}`;

          return {
            ...s,
            team: teamDisplayById.get(s.entrantId) ?? { header: "Unknown", subtext: null },
            advancementReason: groupIsComplete ? reasons?.advancementReason ?? null : null,
            outcomeNote,
            stats: [
              { k: "W–L", v: `${s.wins}-${s.losses}` },
              { k: "DIFF", v: `${s.pointDifferential >= 0 ? "+" : ""}${s.pointDifferential}` },
              { k: "PTS FOR", v: s.pointsFor },
              { k: "PTS AGST", v: s.pointsAgainst },
            ],
            history: matchHistoryForEntrant(s.entrantId, groupMatches, teamDisplayById),
          };
        }),
      });
    }
  }
  return result;
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

function labelForSlotRef(ref: MatchSide, stageNameByKey: Map<string, string>): TeamDisplay {
  const header = (() => {
    if (ref.kind === "entrant") return "TBD";
    if (ref.kind === "bye") return "Bye";
    if (ref.kind === "group_rank") {
      const groupClean = ref.group.replace(/^(Bracket|Pool|Group)\s*/i, "").trim();
      const groupLabel = groupClean ? `Pool ${groupClean}` : ref.group;
      return `${groupLabel} — ${ordinal(ref.rank)}`;
    }
    // Short enough to fit a bracket node: "Winner of QF M3", not
    // "Winner of Quarterfinals Match #3", which truncates to nothing useful.
    const raw = (stageNameByKey.get(ref.stage) ?? ref.stage).toLowerCase();
    const short = raw.includes("16")
      ? "R16"
      : raw.includes("quarter")
        ? "QF"
        : raw.includes("semi")
          ? "SF"
          : raw.includes("third")
            ? "3rd"
            : "Final";
    return `${ref.outcome === "winner" ? "Winner" : "Loser"} of ${short} M${ref.match}`;
  })();
  return { header, subtext: null };
}

/** Field names match MatchListRow so both render through MatchCardBody. */
export type PublicBracketMatch = {
  matchNumber: number;
  stageMatchIndex?: number;
  stageTotalMatches?: number;
  matchLabel?: string;
  fullBadgeText?: string;
  status: string | null;
  home: TeamDisplay;
  away: TeamDisplay;
  homePointsTotal: number | null;
  awayPointsTotal: number | null;
  winnerSide: "home" | "away" | null;
  resultType: string | null;
};

export type PublicBracketStage = {
  stageKey: string;
  stageName: string;
  matches: PublicBracketMatch[];
};

/**
 * Per knockout stage, every planned match -- resolved (real teams, scores if
 * played) or not (a human-readable source label built from the bracket_node's
 * stored ref, e.g. "Pool A -- 1st", never a bare "TBD").
 *
 * Match numbers are continuous across the competition from round-robin up to finals,
 * and indicate the stage match progress (e.g. Quarterfinals Match 1 of 4).
 */
export async function getPublicBracket(tournamentId: string): Promise<PublicBracketStage[]> {
  const supabase = getServiceSupabase();
  const snapshot = await loadTournamentSnapshot(supabase, tournamentId);
  if (snapshot.stages.length === 0) return [];

  const stageNameByKey = new Map(snapshot.stages.map((s) => [s.key, s.name]));
  const matchIds = snapshot.matches.map((m) => m.id);
  const [{ data: results }, teamDisplayById, { data: courts }] = await Promise.all([
    matchIds.length ? supabase.from("match_result").select("*").in("match_id", matchIds) : Promise.resolve({ data: [] as Tables<"match_result">[] }),
    getTournamentTeamDisplays(tournamentId),
    supabase.from("court").select("id, name, is_available").eq("tournament_id", tournamentId),
  ]);
  const courtNameById = new Map((courts ?? []).map((c) => [c.id, c.name]));
  const resultByMatchId = new Map((results ?? []).map((r) => [r.match_id, r]));
  const BYE_DISPLAY: TeamDisplay = { header: "Bye", subtext: null };

  // Number every planned slot through the same helper the Matches and Schedule
  // pages use, so one match carries one number across the whole app. A knockout
  // slot that has no match row yet is numbered from its bracket_node position.
  const stageSequenceById = new Map(snapshot.stages.map((s) => [s.id, s.sequence]));
  const groupOrderById = new Map(snapshot.groups.map((g) => [g.id, g.display_order]));

  const plannedNumbersByStage = new Map<string, number[]>();
  for (const stage of snapshot.stages) {
    if (stage.format_key !== "single_elimination") continue;
    const nums = new Set<number>();
    snapshot.matches.filter((m) => m.stage_id === stage.id).forEach((m) => nums.add(m.match_number));
    snapshot.bracketNodes.filter((n) => n.stage_id === stage.id).forEach((n) => nums.add(n.position));
    plannedNumbersByStage.set(stage.id, [...nums].sort((a, b) => a - b));
  }

  const slotKey = (stageId: string, num: number) => `${stageId}:${num}`;
  const numberById = continuousMatchNumbers(
    [
      ...snapshot.matches
        .filter((m) => !plannedNumbersByStage.has(m.stage_id))
        .map((m) => ({ id: slotKey(m.stage_id, m.match_number), stageId: m.stage_id, groupId: m.group_id, matchNumber: m.match_number })),
      ...[...plannedNumbersByStage].flatMap(([stageId, nums]) =>
        nums.map((num) => ({ id: slotKey(stageId, num), stageId, groupId: null, matchNumber: num })),
      ),
    ],
    {
      stageSequenceById,
      groupOrderById,
      // One bracket per court, so the courts decide how many brackets are
      // interleaved before the numbering moves on to the next batch.
      bracketsPerBatch: (courts ?? []).filter((c) => c.is_available).length || undefined,
    },
  );

  const bracketStages: PublicBracketStage[] = [];
  for (const stage of snapshot.stages) {
    if (stage.format_key !== "single_elimination") continue;

    const existing = snapshot.matches
      .filter((m) => m.stage_id === stage.id)
      .sort((a, b) => a.match_number - b.match_number);
    const nodesByPosition = new Map(
      snapshot.bracketNodes.filter((n) => n.stage_id === stage.id).map((n) => [n.position, n]),
    );

    const sortedNumbers = plannedNumbersByStage.get(stage.id) ?? [];
    const cleanStageName = stageLabel({ stageKey: stage.key, stageName: stage.name }).stage;
    const stageTotalMatches = sortedNumbers.length;

    const matches: PublicBracketMatch[] = sortedNumbers.map((num, idx) => {
      const continuousNumber = numberById.get(slotKey(stage.id, num)) ?? num;
      const stageMatchIndex = idx + 1;

      const matchLabel =
        stageTotalMatches > 1 ? `${cleanStageName} (Match ${stageMatchIndex} of ${stageTotalMatches})` : cleanStageName;

      const courtRow = existing.find((m) => m.match_number === num);
      const fullBadgeText = `M${continuousNumber} · ${matchLabel} · ${courtLabel(courtNameById.get(courtRow?.court_id ?? ""))}`;

      const match = existing.find((m) => m.match_number === num);
      if (match) {
        const result = resultByMatchId.get(match.id);
        const winnerId = result?.winner_team_id ?? null;
        // An empty side is only a bye once the match says so. Otherwise the
        // other half of the tie simply has not been decided yet, and the slot
        // should say where its team will come from.
        const slotNode = nodesByPosition.get(num);
        const emptySide = (ref: unknown): TeamDisplay =>
          match.status === "bye"
            ? BYE_DISPLAY
            : slotNode
              ? labelForSlotRef(ref as MatchSide, stageNameByKey)
              : { header: "TBD", subtext: null };
        return {
          matchNumber: continuousNumber,
          stageMatchIndex,
          stageTotalMatches,
          matchLabel,
          fullBadgeText,
          status: match.status,
          home: match.home_team_id
            ? teamDisplayById.get(match.home_team_id) ?? { header: "Unknown", subtext: null }
            : emptySide(slotNode?.home_ref),
          away: match.away_team_id
            ? teamDisplayById.get(match.away_team_id) ?? { header: "Unknown", subtext: null }
            : emptySide(slotNode?.away_ref),
          homePointsTotal: result?.home_points_total ?? null,
          awayPointsTotal: result?.away_points_total ?? null,
          winnerSide: winnerId ? (winnerId === match.home_team_id ? ("home" as const) : ("away" as const)) : null,
          resultType: result?.result_type ?? null,
        };
      }
      const node = nodesByPosition.get(num);
      const tbd: TeamDisplay = { header: "TBD", subtext: null };
      return {
        matchNumber: continuousNumber,
        stageMatchIndex,
        stageTotalMatches,
        matchLabel,
        fullBadgeText,
        status: null,
        home: node ? labelForSlotRef(node.home_ref as unknown as MatchSide, stageNameByKey) : tbd,
        away: node ? labelForSlotRef(node.away_ref as unknown as MatchSide, stageNameByKey) : tbd,
        homePointsTotal: null,
        awayPointsTotal: null,
        winnerSide: null,
        resultType: null,
      };
    });

    bracketStages.push({ stageKey: stage.key, stageName: cleanStageName, matches });
  }
  return bracketStages;
}
