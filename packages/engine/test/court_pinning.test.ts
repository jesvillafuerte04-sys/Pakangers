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

/** A round robin: every team in the bracket plays every other one once. */
function roundRobin(groupOrder: number, teams: number, pinnedCourtId: string | null = null): SchedulableMatch[] {
  const out: SchedulableMatch[] = [];
  let n = 1;
  for (let i = 0; i < teams; i++) {
    for (let j = i + 1; j < teams; j++) {
      out.push({
        id: `g${groupOrder}m${n}`,
        entrantIds: [`g${groupOrder}t${i}`, `g${groupOrder}t${j}`],
        stageSequence: 1,
        matchNumber: groupOrder * 100 + n,
        groupId: `g${groupOrder}`,
        groupOrder,
        pinnedCourtId,
      });
      n++;
    }
  }
  return out;
}

const courtSet = (n: number): SchedulableCourt[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: `Court ${i + 1}`, isAvailable: true }));

test('spare courts are shared out, so two brackets use four courts', () => {
  const matches = [...roundRobin(0, 7), ...roundRobin(1, 6)];
  const a = autoSchedule(matches, courtSet(4), DEFAULT_SCHEDULE_OPTIONS);

  const courtsOf = (g: number) =>
    new Set(a.filter((x) => x.matchId.startsWith(`g${g}m`)).map((x) => x.courtId));

  assert.equal(courtsOf(0).size, 2, 'Bracket A spreads over two courts');
  assert.equal(courtsOf(1).size, 2, 'Bracket B spreads over the other two');
  assert.equal(new Set([...courtsOf(0), ...courtsOf(1)]).size, 4, 'all four courts are used');

  const shared = [...courtsOf(0)].filter((c) => courtsOf(1).has(c));
  assert.deepEqual(shared, [], 'no court carries matches from both brackets');
});

test('sharing courts shortens the day', () => {
  const matches = [...roundRobin(0, 7), ...roundRobin(1, 6)];
  const onTwo = autoSchedule(matches, courtSet(2), DEFAULT_SCHEDULE_OPTIONS);
  const onFour = autoSchedule(matches, courtSet(4), DEFAULT_SCHEDULE_OPTIONS);

  const rounds = (a: ReturnType<typeof autoSchedule>) => Math.max(...a.map((x) => x.round ?? 0)) + 1;
  assert.ok(rounds(onFour) < rounds(onTwo), `four courts (${rounds(onFour)}) beat two (${rounds(onTwo)})`);
});

test('a team is never put on two courts at the same time', () => {
  const a = autoSchedule([...roundRobin(0, 7), ...roundRobin(1, 6)], courtSet(4), DEFAULT_SCHEDULE_OPTIONS);
  const matches = [...roundRobin(0, 7), ...roundRobin(1, 6)];
  const byId = new Map(matches.map((m) => [m.id, m]));

  const seen = new Map<string, Set<number>>();
  for (const x of a) {
    if (x.round === null) continue;
    for (const team of byId.get(x.matchId)!.entrantIds) {
      const rounds = seen.get(team) ?? new Set<number>();
      assert.ok(!rounds.has(x.round), `${team} is in two matches in round ${x.round}`);
      rounds.add(x.round);
      seen.set(team, rounds);
    }
  }
});

test('a pinned bracket keeps its one court while the other spreads', () => {
  const matches = [...roundRobin(0, 6, 'c1'), ...roundRobin(1, 6)];
  const a = autoSchedule(matches, courtSet(4), DEFAULT_SCHEDULE_OPTIONS);

  const courtsOf = (g: number) =>
    new Set(a.filter((x) => x.matchId.startsWith(`g${g}m`)).map((x) => x.courtId));

  assert.deepEqual([...courtsOf(0)], ['c1'], 'the pinned bracket stays put');
  assert.ok(!courtsOf(1).has('c1'), 'the other bracket keeps off the pinned court');
  assert.equal(courtsOf(1).size, 3, 'and takes the three courts left over');
});
