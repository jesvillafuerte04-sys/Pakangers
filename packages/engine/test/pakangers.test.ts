import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundRobinFormat } from '../src/formats/round_robin.ts';
import { singleEliminationFormat } from '../src/formats/single_elimination.ts';
import { computeStandings } from '../src/standings.ts';
import { resolveSlotRef, type ResolutionContext } from '../src/slots.ts';
import type { Entrant, Match, MatchSide, ScoringConfig, SlotRef, StageConfig } from '../src/types.ts';

const poolScoring: ScoringConfig = { pointsToWin: 11, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' };
const knockoutScoring: ScoringConfig = { pointsToWin: 15, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' };
const tiebreakers = ['match_wins', 'point_differential', 'points_scored'] as const;

/** Deterministic outcome for a repeatable test: the lower team number always wins. */
function idNum(id: string): number {
  return Number(id.slice(1));
}
function stronger(a: string, b: string): string {
  return idNum(a) < idNum(b) ? a : b;
}

function materialize(matchNumber: number, round: number, group: string | undefined, homeId: string, awayId: string, scoring: ScoringConfig, winnerScore: number, loserScore: number): Match {
  const winner = stronger(homeId, awayId);
  const homeIsWinner = winner === homeId;
  return {
    matchNumber, round, group,
    homeEntrantId: homeId, awayEntrantId: awayId,
    status: 'completed', source: 'generated', scoringConfig: scoring,
    games: [{
      gameNumber: 1,
      homeScore: homeIsWinner ? winnerScore : loserScore,
      awayScore: homeIsWinner ? loserScore : winnerScore,
    }],
  };
}

function sideEntrantId(side: MatchSide): string {
  assert.equal(side.kind, 'entrant');
  return (side as { kind: 'entrant'; entrantId: string }).entrantId;
}

/**
 * Runs the full Pakangers structure — two pools, round robin to 11, top 2 advance,
 * crossover semifinals to 15, third place, championship — for a given group split,
 * and returns the final placements.
 */
function runPakangersTournament(groupA: string[], groupB: string[]) {
  const entrants: Entrant[] = [...groupA, ...groupB].map((id) => ({ id, name: id }));

  // Stage 1: pools
  const poolsCfg: StageConfig = {
    key: 'pools', name: 'Pool Stage', formatKey: 'round_robin',
    scoring: poolScoring, tiebreakers: [...tiebreakers],
    groups: [{ name: 'A', entrantIds: groupA }, { name: 'B', entrantIds: groupB }],
  };
  const plannedPools = roundRobinFormat.generateMatches(poolsCfg, entrants);
  const poolMatches = plannedPools.map((p) =>
    materialize(p.matchNumber, p.round, p.group, sideEntrantId(p.home), sideEntrantId(p.away), poolScoring, 11, 5));

  const standingsByGroup = new Map([
    ['A', computeStandings(groupA, poolMatches.filter((m) => m.group === 'A'), [...tiebreakers])],
    ['B', computeStandings(groupB, poolMatches.filter((m) => m.group === 'B'), [...tiebreakers])],
  ]);

  // Stage 2: crossover semifinals (A1-B2, B1-A2)
  const semisCfg: StageConfig = {
    key: 'semifinals', name: 'Semifinals', formatKey: 'single_elimination',
    scoring: knockoutScoring, tiebreakers: [],
    entrants: [
      { match: 1, home: { kind: 'group_rank', group: 'A', rank: 1 }, away: { kind: 'group_rank', group: 'B', rank: 2 } },
      { match: 2, home: { kind: 'group_rank', group: 'B', rank: 1 }, away: { kind: 'group_rank', group: 'A', rank: 2 } },
    ],
  };
  const ctx: ResolutionContext = { standingsByGroup, matchesByStageAndNumber: new Map() };
  const plannedSemis = singleEliminationFormat.generateMatches(semisCfg, []);
  const semiMatches = plannedSemis.map((p) => {
    const homeId = resolveSlotRef(p.home as SlotRef, ctx);
    const awayId = resolveSlotRef(p.away as SlotRef, ctx);
    assert.ok(homeId, `semifinal match ${p.matchNumber} home slot should resolve`);
    assert.ok(awayId, `semifinal match ${p.matchNumber} away slot should resolve`);
    return materialize(p.matchNumber, p.round, undefined, homeId!, awayId!, knockoutScoring, 15, 10);
  });
  for (const m of semiMatches) ctx.matchesByStageAndNumber.set(`semifinals:${m.matchNumber}`, m);

  // Stage 3: third place (losers of the semifinals)
  const thirdCfg: StageConfig = {
    key: 'third_place', name: 'Third Place', formatKey: 'single_elimination',
    scoring: knockoutScoring, tiebreakers: [],
    entrants: [{
      match: 1,
      home: { kind: 'match_outcome', stage: 'semifinals', match: 1, outcome: 'loser' },
      away: { kind: 'match_outcome', stage: 'semifinals', match: 2, outcome: 'loser' },
    }],
  };
  const plannedThird = singleEliminationFormat.generateMatches(thirdCfg, []);
  const thirdHome = resolveSlotRef(plannedThird[0]!.home as SlotRef, ctx);
  const thirdAway = resolveSlotRef(plannedThird[0]!.away as SlotRef, ctx);
  assert.ok(thirdHome && thirdAway, 'third place slots should resolve once semifinals are complete');
  const thirdMatch = materialize(1, 1, undefined, thirdHome!, thirdAway!, knockoutScoring, 15, 10);

  // Stage 4: championship (winners of the semifinals)
  const champCfg: StageConfig = {
    key: 'championship', name: 'Championship', formatKey: 'single_elimination',
    scoring: knockoutScoring, tiebreakers: [],
    entrants: [{
      match: 1,
      home: { kind: 'match_outcome', stage: 'semifinals', match: 1, outcome: 'winner' },
      away: { kind: 'match_outcome', stage: 'semifinals', match: 2, outcome: 'winner' },
    }],
  };
  const plannedChamp = singleEliminationFormat.generateMatches(champCfg, []);
  const champHome = resolveSlotRef(plannedChamp[0]!.home as SlotRef, ctx);
  const champAway = resolveSlotRef(plannedChamp[0]!.away as SlotRef, ctx);
  assert.ok(champHome && champAway, 'championship slots should resolve once semifinals are complete');
  const champMatch = materialize(1, 1, undefined, champHome!, champAway!, knockoutScoring, 15, 10);

  const champWinner = stronger(champMatch.homeEntrantId!, champMatch.awayEntrantId!);
  const champLoser = champWinner === champMatch.homeEntrantId ? champMatch.awayEntrantId! : champMatch.homeEntrantId!;
  const thirdWinner = stronger(thirdMatch.homeEntrantId!, thirdMatch.awayEntrantId!);

  return {
    poolMatches, standingsByGroup, semiMatches, thirdMatch, champMatch,
    champion: champWinner, runnerUp: champLoser, third: thirdWinner,
  };
}

test('9 teams (4 + 5 pools): full tournament resolves to the correct podium', () => {
  const groupA = ['T1', 'T2', 'T3', 'T4'];
  const groupB = ['T5', 'T6', 'T7', 'T8', 'T9'];
  const result = runPakangersTournament(groupA, groupB);

  assert.equal(result.standingsByGroup.get('A')![0]!.entrantId, 'T1');
  assert.equal(result.standingsByGroup.get('A')![1]!.entrantId, 'T2');
  assert.equal(result.standingsByGroup.get('B')![0]!.entrantId, 'T5');
  assert.equal(result.standingsByGroup.get('B')![1]!.entrantId, 'T6');

  // Semifinal 1: A1(T1) vs B2(T6); Semifinal 2: B1(T5) vs A2(T2)
  assert.equal(result.semiMatches[0]!.homeEntrantId, 'T1');
  assert.equal(result.semiMatches[0]!.awayEntrantId, 'T6');
  assert.equal(result.semiMatches[1]!.homeEntrantId, 'T5');
  assert.equal(result.semiMatches[1]!.awayEntrantId, 'T2');

  assert.equal(result.champion, 'T1');
  assert.equal(result.runnerUp, 'T2');
  assert.equal(result.third, 'T5');
});

test('10 teams (5 + 5 pools): full tournament resolves to the correct podium', () => {
  const groupA = ['T1', 'T2', 'T3', 'T4', 'T5'];
  const groupB = ['T6', 'T7', 'T8', 'T9', 'T10'];
  const result = runPakangersTournament(groupA, groupB);

  assert.equal(result.standingsByGroup.get('A')![0]!.entrantId, 'T1');
  assert.equal(result.standingsByGroup.get('A')![1]!.entrantId, 'T2');
  assert.equal(result.standingsByGroup.get('B')![0]!.entrantId, 'T6');
  assert.equal(result.standingsByGroup.get('B')![1]!.entrantId, 'T7');

  assert.equal(result.semiMatches[0]!.homeEntrantId, 'T1');
  assert.equal(result.semiMatches[0]!.awayEntrantId, 'T7');
  assert.equal(result.semiMatches[1]!.homeEntrantId, 'T6');
  assert.equal(result.semiMatches[1]!.awayEntrantId, 'T2');

  assert.equal(result.champion, 'T1');
  assert.equal(result.runnerUp, 'T2');
  assert.equal(result.third, 'T6');
});

test('pool match counts match the 4+5 split exactly (6 + 10 matches)', () => {
  const result = runPakangersTournament(['T1', 'T2', 'T3', 'T4'], ['T5', 'T6', 'T7', 'T8', 'T9']);
  assert.equal(result.poolMatches.filter((m) => m.group === 'A').length, 6);
  assert.equal(result.poolMatches.filter((m) => m.group === 'B').length, 10);
});

test('third place and championship slots stay unresolved before the semifinals complete', () => {
  const emptyCtx: ResolutionContext = { standingsByGroup: new Map(), matchesByStageAndNumber: new Map() };
  const ref: SlotRef = { kind: 'match_outcome', stage: 'semifinals', match: 1, outcome: 'winner' };
  assert.equal(resolveSlotRef(ref, emptyCtx), null);
});
