import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundRobinFormat } from '../src/formats/round_robin.ts';
import type { Entrant, MatchSide, StageConfig } from '../src/types.ts';

function makeEntrants(n: number): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, name: `Team ${i + 1}` }));
}

function baseCfg(overrides: Partial<StageConfig> = {}): StageConfig {
  return {
    key: 'pool',
    name: 'Pool',
    formatKey: 'round_robin',
    scoring: { pointsToWin: 11, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' },
    tiebreakers: ['match_wins', 'point_differential', 'points_scored'],
    ...overrides,
  };
}

function entrantId(side: MatchSide): string {
  assert.equal(side.kind, 'entrant');
  return (side as { kind: 'entrant'; entrantId: string }).entrantId;
}

for (const n of [4, 5, 8, 9, 10]) {
  test(`round robin with ${n} teams: correct round count, every pair meets exactly once`, () => {
    const entrants = makeEntrants(n);
    const planned = roundRobinFormat.generateMatches(baseCfg(), entrants);

    const expectedRounds = n % 2 === 0 ? n - 1 : n;
    const maxRound = Math.max(...planned.map((m) => m.round));
    assert.equal(maxRound, expectedRounds, `expected ${expectedRounds} rounds for n=${n}`);

    const seenPairs = new Set<string>();
    const matchCount = new Map<string, number>();
    for (const m of planned) {
      const a = entrantId(m.home);
      const b = entrantId(m.away);
      const key = [a, b].sort().join('-');
      assert.ok(!seenPairs.has(key), `pair ${key} scheduled more than once`);
      seenPairs.add(key);
      matchCount.set(a, (matchCount.get(a) ?? 0) + 1);
      matchCount.set(b, (matchCount.get(b) ?? 0) + 1);
    }

    assert.equal(seenPairs.size, (n * (n - 1)) / 2, 'every possible pair should appear exactly once');
    for (const e of entrants) {
      assert.equal(matchCount.get(e.id), n - 1, `${e.id} should play exactly ${n - 1} matches`);
    }

    // No team plays twice in the same round.
    const byRound = new Map<number, Set<string>>();
    for (const m of planned) {
      const set = byRound.get(m.round) ?? new Set<string>();
      for (const id of [entrantId(m.home), entrantId(m.away)]) {
        assert.ok(!set.has(id), `${id} scheduled twice in round ${m.round}`);
        set.add(id);
      }
      byRound.set(m.round, set);
    }
  });
}

test('round robin with a 9-team, 4+5 group split matches the Pakangers configuration', () => {
  const entrants = makeEntrants(9);
  const cfg = baseCfg({
    groups: [
      { name: 'Sunrise Pool', entrantIds: entrants.slice(0, 4).map((e) => e.id) },
      { name: 'Sunset Pool', entrantIds: entrants.slice(4).map((e) => e.id) },
    ],
  });
  const planned = roundRobinFormat.generateMatches(cfg, entrants);

  assert.equal(planned.filter((m) => m.group === 'Sunrise Pool').length, 6); // C(4,2)
  assert.equal(planned.filter((m) => m.group === 'Sunset Pool').length, 10); // C(5,2)
  assert.equal(Math.max(...planned.filter((m) => m.group === 'Sunrise Pool').map((m) => m.round)), 3);
  assert.equal(Math.max(...planned.filter((m) => m.group === 'Sunset Pool').map((m) => m.round)), 5);
});

test('validate flags a group with fewer than 2 teams', () => {
  const entrants = makeEntrants(1);
  const issues = roundRobinFormat.validate(baseCfg(), entrants);
  assert.ok(issues.some((i) => i.code === 'round_robin.group_too_small'));
});
