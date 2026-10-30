/** Run: node --test --experimental-strip-types test/court_pinning.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoSchedule, DEFAULT_SCHEDULE_OPTIONS } from '../src/scheduling.ts';
import type { SchedulableCourt, SchedulableMatch } from '../src/scheduling.ts';

const courts: SchedulableCourt[] = [
  { id: 'c1', name: 'Court 1', isAvailable: true },
  { id: 'c2', name: 'Court 2', isAvailable: true },
];

/** Three matches in each of two brackets, so a bracket fills a court's queue. */
function bracketMatches(groupOrder: number, pinnedCourtId: string | null = null): SchedulableMatch[] {
  return [1, 2, 3].map((n) => ({
    id: `g${groupOrder}m${n}`,
    entrantIds: [`g${groupOrder}t${n}`, `g${groupOrder}t${n + 10}`],
    stageSequence: 1,
    matchNumber: groupOrder * 10 + n,
    groupId: `g${groupOrder}`,
    groupOrder,
    pinnedCourtId,
  }));
}

const courtOf = (assignments: ReturnType<typeof autoSchedule>, id: string) =>
  assignments.find((a) => a.matchId === id)?.courtId;

test('a bracket pinned to a court is played there', () => {
  const matches = [...bracketMatches(0, 'c2'), ...bracketMatches(1)];
  const a = autoSchedule(matches, courts, DEFAULT_SCHEDULE_OPTIONS);

  for (const n of [1, 2, 3]) assert.equal(courtOf(a, `g0m${n}`), 'c2', 'the pinned bracket stays on Court 2');
  for (const n of [1, 2, 3]) assert.equal(courtOf(a, `g1m${n}`), 'c1', 'the unpinned bracket takes the free court');
});

test('an unpinned bracket never lands on a court already claimed by a pinned one', () => {
  // Bracket B is pinned to Court 1 -- the court bracket A would otherwise take.
  const matches = [...bracketMatches(0), ...bracketMatches(1, 'c1')];
  const a = autoSchedule(matches, courts, DEFAULT_SCHEDULE_OPTIONS);

  assert.equal(courtOf(a, 'g1m1'), 'c1');
  assert.equal(courtOf(a, 'g0m1'), 'c2', 'bracket A is pushed to the other court');
});

test('with nothing pinned, one bracket still gets one court', () => {
  const matches = [...bracketMatches(0), ...bracketMatches(1)];
  const a = autoSchedule(matches, courts, DEFAULT_SCHEDULE_OPTIONS);

  for (const g of [0, 1]) {
    const used = new Set([1, 2, 3].map((n) => courtOf(a, `g${g}m${n}`)));
    assert.equal(used.size, 1, `bracket ${g} is played entirely on one court`);
  }
  assert.notEqual(courtOf(a, 'g0m1'), courtOf(a, 'g1m1'), 'the two brackets run in parallel');
});

test('more brackets than courts queue up behind each other', () => {
  const matches = [...bracketMatches(0), ...bracketMatches(1), ...bracketMatches(2)];
  const a = autoSchedule(matches, courts, DEFAULT_SCHEDULE_OPTIONS);

  const rounds = [1, 2, 3].map((n) => a.find((x) => x.matchId === `g2m${n}`)!.round);
  assert.deepEqual(rounds, [3, 4, 5], 'the third bracket starts after the first finishes on that court');
});

test('a pinned court that is unavailable is ignored rather than honoured', () => {
  const closed: SchedulableCourt[] = [courts[0]!, { id: 'c2', name: 'Court 2', isAvailable: false }];
  const a = autoSchedule(bracketMatches(0, 'c2'), closed, DEFAULT_SCHEDULE_OPTIONS);

  assert.equal(courtOf(a, 'g0m1'), 'c1', 'the bracket falls back to a court that is open');
});
