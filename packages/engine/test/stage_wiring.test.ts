import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSlotRef, type ResolutionContext } from '../src/slots.ts';
import { resolveQualifiers } from '../src/qualification.ts';
import { computeStandings } from '../src/standings.ts';
import type { Match, ScoringConfig, Standing } from '../src/types.ts';

const scoring: ScoringConfig = { pointsToWin: 15, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' };

function completedMatch(num: number, home: string, away: string, hs: number, as: number): Match {
  return {
    matchNumber: num, round: 1, homeEntrantId: home, awayEntrantId: away,
    status: 'completed', source: 'generated', scoringConfig: scoring,
    games: [{ gameNumber: 1, homeScore: hs, awayScore: as }],
  };
}

test('group_rank resolves to the entrant at that rank in the source group standings', () => {
  const standings: Standing[] = computeStandings(
    ['A1', 'A2', 'A3'],
    [completedMatch(1, 'A1', 'A2', 11, 5), completedMatch(2, 'A1', 'A3', 11, 3), completedMatch(3, 'A2', 'A3', 11, 7)],
    ['match_wins'],
  );
  const ctx: ResolutionContext = {
    standingsByGroup: new Map([['A', standings]]),
    matchesByStageAndNumber: new Map(),
  };
  assert.equal(resolveSlotRef({ kind: 'group_rank', group: 'A', rank: 1 }, ctx), 'A1');
  assert.equal(resolveSlotRef({ kind: 'group_rank', group: 'A', rank: 2 }, ctx), 'A2');
});

test('group_rank returns null when the source group has not reported standings yet', () => {
  const ctx: ResolutionContext = { standingsByGroup: new Map(), matchesByStageAndNumber: new Map() };
  assert.equal(resolveSlotRef({ kind: 'group_rank', group: 'A', rank: 1 }, ctx), null);
});

test('match_outcome resolves winner and loser of a completed match in another stage', () => {
  const semi = completedMatch(1, 'T1', 'T6', 15, 10);
  const ctx: ResolutionContext = {
    standingsByGroup: new Map(),
    matchesByStageAndNumber: new Map([['semifinals:1', semi]]),
  };
  assert.equal(resolveSlotRef({ kind: 'match_outcome', stage: 'semifinals', match: 1, outcome: 'winner' }, ctx), 'T1');
  assert.equal(resolveSlotRef({ kind: 'match_outcome', stage: 'semifinals', match: 1, outcome: 'loser' }, ctx), 'T6');
});

test('match_outcome returns null until the referenced match is completed', () => {
  const pending: Match = {
    matchNumber: 1, round: 1, homeEntrantId: 'T1', awayEntrantId: 'T6',
    status: 'pending', source: 'generated', scoringConfig: scoring, games: [],
  };
  const ctx: ResolutionContext = {
    standingsByGroup: new Map(),
    matchesByStageAndNumber: new Map([['semifinals:1', pending]]),
  };
  assert.equal(resolveSlotRef({ kind: 'match_outcome', stage: 'semifinals', match: 1, outcome: 'winner' }, ctx), null);
});

test('match_outcome winner of a bye is the present side; a bye has no loser to reference', () => {
  const bye: Match = {
    matchNumber: 1, round: 1, homeEntrantId: 'T1', awayEntrantId: null,
    status: 'bye', source: 'generated', scoringConfig: scoring, games: [],
  };
  const ctx: ResolutionContext = {
    standingsByGroup: new Map(),
    matchesByStageAndNumber: new Map([['knockout:1', bye]]),
  };
  assert.equal(resolveSlotRef({ kind: 'match_outcome', stage: 'knockout', match: 1, outcome: 'winner' }, ctx), 'T1');
  assert.equal(resolveSlotRef({ kind: 'match_outcome', stage: 'knockout', match: 1, outcome: 'loser' }, ctx), null);
});

test('resolveQualifiers: top_n takes the first N by rank', () => {
  const standings: Standing[] = computeStandings(
    ['A', 'B', 'C', 'D'],
    [
      completedMatch(1, 'A', 'B', 11, 2),
      completedMatch(2, 'A', 'C', 11, 2),
      completedMatch(3, 'A', 'D', 11, 2),
      completedMatch(4, 'B', 'C', 11, 2),
    ],
    ['match_wins'],
  );
  const qualifiers = resolveQualifiers(standings, { method: 'top_n', value: 2 });
  assert.deepEqual(qualifiers.map((s) => s.entrantId), ['A', 'B']);
});

test('resolveQualifiers: top_percent rounds up', () => {
  const standings: Standing[] = [
    { entrantId: 'A', rank: 1, wins: 3, losses: 0, gamesWon: 3, gamesLost: 0, pointsFor: 0, pointsAgainst: 0, pointDifferential: 0, winPercentage: 1, unresolvedTie: false },
    { entrantId: 'B', rank: 2, wins: 2, losses: 1, gamesWon: 2, gamesLost: 1, pointsFor: 0, pointsAgainst: 0, pointDifferential: 0, winPercentage: 0.67, unresolvedTie: false },
    { entrantId: 'C', rank: 3, wins: 1, losses: 2, gamesWon: 1, gamesLost: 2, pointsFor: 0, pointsAgainst: 0, pointDifferential: 0, winPercentage: 0.33, unresolvedTie: false },
  ];
  // 50% of 3 -> ceil(1.5) = 2
  const qualifiers = resolveQualifiers(standings, { method: 'top_percent', value: 50 });
  assert.deepEqual(qualifiers.map((s) => s.entrantId), ['A', 'B']);
});

test('resolveQualifiers: threshold filters by minimum wins', () => {
  const standings: Standing[] = [
    { entrantId: 'A', rank: 1, wins: 3, losses: 0, gamesWon: 0, gamesLost: 0, pointsFor: 0, pointsAgainst: 0, pointDifferential: 0, winPercentage: 1, unresolvedTie: false },
    { entrantId: 'B', rank: 2, wins: 1, losses: 2, gamesWon: 0, gamesLost: 0, pointsFor: 0, pointsAgainst: 0, pointDifferential: 0, winPercentage: 0.33, unresolvedTie: false },
  ];
  const qualifiers = resolveQualifiers(standings, { method: 'threshold', value: 2 });
  assert.deepEqual(qualifiers.map((s) => s.entrantId), ['A']);
});
