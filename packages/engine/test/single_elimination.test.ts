import { test } from 'node:test';
import assert from 'node:assert/strict';
import { singleEliminationFormat } from '../src/formats/single_elimination.ts';
import type { Entrant, MatchSide, StageConfig } from '../src/types.ts';

function makeSeededEntrants(n: number): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, name: `Team ${i + 1}`, seed: i + 1 }));
}

function baseCfg(): StageConfig {
  return {
    key: 'knockout',
    name: 'Knockout',
    formatKey: 'single_elimination',
    scoring: { pointsToWin: 15, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' },
    tiebreakers: ['match_wins', 'point_differential', 'points_scored'],
  };
}

function idOf(side: MatchSide): string | undefined {
  return side.kind === 'entrant' ? side.entrantId : undefined;
}

test('8 entrants: standard seeding (1v8, 4v5, 2v7, 3v6), no byes', () => {
  const entrants = makeSeededEntrants(8);
  const planned = singleEliminationFormat.generateMatches(baseCfg(), entrants);

  const round1 = planned.filter((m) => m.round === 1);
  assert.equal(round1.length, 4);
  assert.ok(round1.every((m) => m.home.kind === 'entrant' && m.away.kind === 'entrant'), 'no byes expected at 8 entrants');
  const pairs = round1.map((m) => [idOf(m.home), idOf(m.away)]);
  assert.deepEqual(pairs, [['T1', 'T8'], ['T4', 'T5'], ['T2', 'T7'], ['T3', 'T6']]);

  assert.equal(planned.filter((m) => m.round === 2).length, 2, 'semifinals');
  assert.equal(planned.filter((m) => m.round === 3).length, 1, 'final');

  // Round 2+ matches reference round 1 winners by match_outcome, not fixed entrants.
  const semi1 = planned.find((m) => m.round === 2)!;
  assert.deepEqual(semi1.home, { kind: 'match_outcome', stage: 'knockout', match: 1, outcome: 'winner' });
});

test('5 entrants: pads to a bracket of 8, byes go to the top 3 seeds', () => {
  const entrants = makeSeededEntrants(5);
  const planned = singleEliminationFormat.generateMatches(baseCfg(), entrants);
  const round1 = planned.filter((m) => m.round === 1);
  assert.equal(round1.length, 4, 'padded to next power of two (8) / 2');

  const byeMatches = round1.filter((m) => m.home.kind === 'bye' || m.away.kind === 'bye');
  assert.equal(byeMatches.length, 3, '8 - 5 = 3 byes');

  const seedsWithByes = byeMatches
    .map((m) => (m.home.kind === 'bye' ? m.away : m.home))
    .map((side) => idOf(side))
    .sort();
  assert.deepEqual(seedsWithByes, ['T1', 'T2', 'T3'], 'byes should go to the top seeds');

  const realMatch = round1.find((m) => m.home.kind === 'entrant' && m.away.kind === 'entrant')!;
  assert.deepEqual([idOf(realMatch.home), idOf(realMatch.away)], ['T4', 'T5']);
});

test('2 entrants: single match, no byes, one round', () => {
  const entrants = makeSeededEntrants(2);
  const planned = singleEliminationFormat.generateMatches(baseCfg(), entrants);
  assert.equal(planned.length, 1);
  assert.equal(planned[0]!.home.kind, 'entrant');
  assert.equal(planned[0]!.away.kind, 'entrant');
});

test('explicit crossover wiring: entrants come from cfg.entrants slot refs, not auto-seeding', () => {
  const cfg: StageConfig = {
    key: 'semifinals',
    name: 'Semifinals',
    formatKey: 'single_elimination',
    scoring: { pointsToWin: 15, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' },
    tiebreakers: [],
    entrants: [
      { match: 1, home: { kind: 'group_rank', group: 'A', rank: 1 }, away: { kind: 'group_rank', group: 'B', rank: 2 } },
      { match: 2, home: { kind: 'group_rank', group: 'B', rank: 1 }, away: { kind: 'group_rank', group: 'A', rank: 2 } },
    ],
  };
  const planned = singleEliminationFormat.generateMatches(cfg, []);
  assert.equal(planned.length, 2);
  assert.deepEqual(planned[0]!.home, { kind: 'group_rank', group: 'A', rank: 1 });
  assert.deepEqual(planned[1]!.away, { kind: 'group_rank', group: 'A', rank: 2 });
});

test('validate rejects fewer than 2 auto-seeded entrants', () => {
  const issues = singleEliminationFormat.validate(baseCfg(), makeSeededEntrants(1));
  assert.ok(issues.some((i) => i.code === 'single_elimination.too_few_entrants'));
});

test('validate does not require an entrant count for explicitly-wired stages', () => {
  const cfg: StageConfig = {
    key: 'championship',
    name: 'Championship',
    formatKey: 'single_elimination',
    scoring: { pointsToWin: 15, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' },
    tiebreakers: [],
    entrants: [{ match: 1, home: { kind: 'match_outcome', stage: 'semifinals', match: 1, outcome: 'winner' }, away: { kind: 'match_outcome', stage: 'semifinals', match: 2, outcome: 'winner' } }],
  };
  const issues = singleEliminationFormat.validate(cfg, []);
  assert.ok(!issues.some((i) => i.code === 'single_elimination.too_few_entrants'));
});
