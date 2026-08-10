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
import { getTeamDisplayMap, type TeamDisplay } from "./team-display";

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

function toEngineMatch(m: MatchRow, allGames: GameRow[], groupNameById: Map<string, string>): EngineMatch {
  return {
    matchNumber: m.match_number,
    round: 0,
    group: m.group_id ? groupNameById.get(m.group_id) : undefined,
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
  flatEntrants: Entrant[];
  plannedByStageKey: Map<string, PlannedMatch[]>;
};

function buildEngineState(snapshot: TournamentSnapshot): EngineState {
  const groupNameById = new Map(snapshot.groups.map((g) => [g.id, g.name]));
  const groupIdByStageAndName = new Map(snapshot.groups.map((g) => [`${g.stage_id}:${g.name}`, g.id]));

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
    list.push(toEngineMatch(m, snapshot.games, groupNameById));
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
  for (const stage of snapshot.stages) {
    const cfg = stageConfigs.get(stage.key)!;
    if (!cfg.groups) continue;
    const planned = plannedByStageKey.get(stage.key)!;
    const stageMatches = engineMatchesByStageId.get(stage.id) ?? [];
    for (const g of cfg.groups) {
      const plannedCount = planned.filter((pm) => pm.group === g.name).length;
      const groupMatches = stageMatches.filter((m) => m.group === g.name);
      const allResolved = plannedCount > 0 && groupMatches.length === plannedCount && groupMatches.every((m) => RESOLVED_STATUSES.includes(m.status));
      if (allResolved) {
        standingsByGroup.set(g.name, engineComputeStandings(g.entrantIds, groupMatches, cfg.tiebreakers));
      }
    }
  }

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
      if (existingByStageAndNumber.has(`${stage.key}:${pm.matchNumber}`)) continue;

      const home = resolveMatchSide(pm.home, ctx);
      const away = resolveMatchSide(pm.away, ctx);
      const isBracketStage = stage.format_key === "single_elimination";

      if (home.kind === "unresolved" || away.kind === "unresolved") {
        if (isBracketStage) await ensureBracketNode(supabase, stage.id, pm, bracketNodeByKey, null);
        continue;
      }

      const groupId = pm.group ? groupIdByStageAndName.get(`${stage.id}:${pm.group}`) ?? null : null;
      const status: MatchStatus = home.kind === "bye" || away.kind === "bye" ? "bye" : "pending";
      const homeTeamId = home.kind === "team" ? home.id : null;
      const awayTeamId = away.kind === "team" ? away.id : null;

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
    if (matchId && !existing.match_id) {
      const { error } = await supabase.from("bracket_node").update({ match_id: matchId }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      existingNodes.set(key, { ...existing, match_id: matchId });
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
  actorName: string;
}): Promise<void> {
  const { tournamentId, matchId, homeTeamId, awayTeamId, games, winnerTeamId, resultType, actorName } = params;
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
  standings: (Standing & { team: TeamDisplay; stats: StandingStat[]; history: StandingHistoryEntry[] })[];
};

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
    getTeamDisplayMap(snapshot.teams.map((t) => t.id)),
  ]);
  const qualifyCountByGroupId = new Map<string, number>();
  for (const r of qualRules ?? []) {
    if (r.from_group_id && r.method === "top_n") qualifyCountByGroupId.set(r.from_group_id, r.value);
  }

  const result: DisplayStandingsGroup[] = [];
  for (const stage of snapshot.stages) {
    const groupsForStage = snapshot.groups.filter((g) => g.stage_id === stage.id);
    if (groupsForStage.length === 0) continue;
    const cfg = buildStageConfig(stage, groupsForStage, teamsByGroup);
    if (!cfg.groups) continue;

    const stageMatches = snapshot.matches
      .filter((m) => m.stage_id === stage.id)
      .map((m) => toEngineMatch(m, snapshot.games, groupNameById));

    for (const g of cfg.groups) {
      const groupRow = groupsForStage.find((gr) => gr.name === g.name)!;
      const groupMatches = stageMatches.filter((m) => m.group === g.name);
      const standings = engineComputeStandings(g.entrantIds, groupMatches, cfg.tiebreakers);
      result.push({
        stageKey: stage.key,
        stageName: stage.name,
        groupName: g.name,
        tiebreakers: cfg.tiebreakers,
        qualifyCount: qualifyCountByGroupId.get(groupRow.id) ?? null,
        standings: standings.map((s) => ({
          ...s,
          team: teamDisplayById.get(s.entrantId) ?? { header: "Unknown", subtext: null },
          stats: [
            { k: "W–L", v: `${s.wins}-${s.losses}` },
            { k: "DIFF", v: `${s.pointDifferential >= 0 ? "+" : ""}${s.pointDifferential}` },
            { k: "PTS FOR", v: s.pointsFor },
            { k: "PTS AGST", v: s.pointsAgainst },
          ],
          history: matchHistoryForEntrant(s.entrantId, groupMatches, teamDisplayById),
        })),
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
    if (ref.kind === "group_rank") return `Pool ${ref.group} — ${ordinal(ref.rank)}`;
    const stageName = stageNameByKey.get(ref.stage) ?? ref.stage;
    return `${ref.outcome === "winner" ? "Winner" : "Loser"} of ${stageName} Match #${ref.match}`;
  })();
  return { header, subtext: null };
}

export type PublicBracketMatch = {
  matchNumber: number;
  status: string | null;
  home: TeamDisplay;
  away: TeamDisplay;
  homeScore: number | null;
  awayScore: number | null;
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
 */
export async function getPublicBracket(tournamentId: string): Promise<PublicBracketStage[]> {
  const supabase = getServiceSupabase();
  const snapshot = await loadTournamentSnapshot(supabase, tournamentId);
  if (snapshot.stages.length === 0) return [];

  const stageNameByKey = new Map(snapshot.stages.map((s) => [s.key, s.name]));
  const matchIds = snapshot.matches.map((m) => m.id);
  const [{ data: results }, teamDisplayById] = await Promise.all([
    matchIds.length ? supabase.from("match_result").select("*").in("match_id", matchIds) : Promise.resolve({ data: [] as Tables<"match_result">[] }),
    getTeamDisplayMap(snapshot.teams.map((t) => t.id)),
  ]);
  const resultByMatchId = new Map((results ?? []).map((r) => [r.match_id, r]));
  const BYE_DISPLAY: TeamDisplay = { header: "Bye", subtext: null };

  const bracketStages: PublicBracketStage[] = [];
  for (const stage of snapshot.stages) {
    if (stage.format_key !== "single_elimination") continue;

    const existing = snapshot.matches
      .filter((m) => m.stage_id === stage.id)
      .sort((a, b) => a.match_number - b.match_number);
    const nodesByPosition = new Map(
      snapshot.bracketNodes.filter((n) => n.stage_id === stage.id).map((n) => [n.position, n]),
    );

    const numbers = new Set<number>();
    existing.forEach((m) => numbers.add(m.match_number));
    nodesByPosition.forEach((_, pos) => numbers.add(pos));

    const matches: PublicBracketMatch[] = [...numbers].sort((a, b) => a - b).map((num) => {
      const match = existing.find((m) => m.match_number === num);
      if (match) {
        const result = resultByMatchId.get(match.id);
        return {
          matchNumber: num,
          status: match.status,
          home: match.home_team_id ? teamDisplayById.get(match.home_team_id) ?? { header: "Unknown", subtext: null } : BYE_DISPLAY,
          away: match.away_team_id ? teamDisplayById.get(match.away_team_id) ?? { header: "Unknown", subtext: null } : BYE_DISPLAY,
          homeScore: result?.home_points_total ?? null,
          awayScore: result?.away_points_total ?? null,
          resultType: result?.result_type ?? null,
        };
      }
      const node = nodesByPosition.get(num);
      const tbd: TeamDisplay = { header: "TBD", subtext: null };
      return {
        matchNumber: num,
        status: null,
        home: node ? labelForSlotRef(node.home_ref as unknown as MatchSide, stageNameByKey) : tbd,
        away: node ? labelForSlotRef(node.away_ref as unknown as MatchSide, stageNameByKey) : tbd,
        homeScore: null,
        awayScore: null,
        resultType: null,
      };
    });

    bracketStages.push({ stageKey: stage.key, stageName: stage.name, matches });
  }
  return bracketStages;
}
