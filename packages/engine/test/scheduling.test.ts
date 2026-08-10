import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoSchedule,
  detectScheduleConflicts,
  type ScheduleAssignment,
  type SchedulableCourt,
  type SchedulableMatch,
} from '../src/scheduling.ts';

const courts = (n: number, available = true): SchedulableCourt[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: `Court ${i + 1}`, isAvailable: available }));

/** Round robin over `teams`, one stage, numbered from 1 like the engine emits. */
function roundRobinMatches(teams: string[], stageSequence = 1): SchedulableMatch[] {
  const out: SchedulableMatch[] = [];
  let n = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      out.push({ id: `m${n}`, entrantIds: [teams[i]!, teams[j]!], stageSequence, matchNumber: n });
      n++;
    }
  }
  return out;
}

function assignmentFor(assignments: ScheduleAssignment[], matchId: string): ScheduleAssignment {
  const a = assignments.find((x) => x.matchId === matchId);
  assert.ok(a, `no assignment for ${matchId}`);
  return a;
}

test('autoSchedule places every match and produces no conflicts', () => {
  const matches = roundRobinMatches(['a', 'b', 'c', 'd']);
  const cs = courts(2);
  const assignments = autoSchedule(matches, cs, { minRestRounds: 1 });

  assert.equal(assignments.length, matches.length);
  assert.ok(assignments.every((a) => a.courtId !== null && a.round !== null));
  const blocking = detectScheduleConflicts(matches, cs, assignments, { minRestRounds: 1 }).filter(
    (i) => i.severity === 'blocking',
  );
  assert.deepEqual(blocking, []);
});

test('autoSchedule never puts a team on two courts in the same round', () => {
  const matches = roundRobinMatches(['a', 'b', 'c', 'd', 'e', 'f']);
  const cs = courts(3);
  const assignments = autoSchedule(matches, cs, { minRestRounds: 0 });

  const seen = new Map<string, Set<number>>();
  for (const a of assignments) {
    const m = matches.find((x) => x.id === a.matchId)!;
    for (const id of m.entrantIds) {
      const rounds = seen.get(id) ?? new Set<number>();
      assert.ok(!rounds.has(a.round!), `${id} double-booked in round ${a.round}`);
      rounds.add(a.round!);
      seen.set(id, rounds);
    }
  }
});

test('autoSchedule respects minRestRounds: a team never plays in consecutive rounds', () => {
  const matches = roundRobinMatches(['a', 'b', 'c', 'd']);
  const assignments = autoSchedule(matches, courts(2), { minRestRounds: 1 });

  const roundsByTeam = new Map<string, number[]>();
  for (const a of assignments) {
    const m = matches.find((x) => x.id === a.matchId)!;
    for (const id of m.entrantIds) {
      roundsByTeam.set(id, [...(roundsByTeam.get(id) ?? []), a.round!]);
    }
  }
  for (const [team, rounds] of roundsByTeam) {
    const sorted = [...rounds].sort((x, y) => x - y);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i]! - sorted[i - 1]! > 1, `${team} plays rounds ${sorted[i - 1]} and ${sorted[i]} back to back`);
    }
  }
});

test('autoSchedule skips unavailable courts entirely', () => {
  const cs: SchedulableCourt[] = [
    { id: 'c1', name: 'Court 1', isAvailable: false },
    { id: 'c2', name: 'Court 2', isAvailable: true },
  ];
  const matches = roundRobinMatches(['a', 'b', 'c', 'd']);
  const assignments = autoSchedule(matches, cs, { minRestRounds: 0 });

  assert.ok(assignments.every((a) => a.courtId === 'c2'));
});

test('autoSchedule leaves everything unscheduled when no court is usable', () => {
  const matches = roundRobinMatches(['a', 'b', 'c']);
  const assignments = autoSchedule(matches, courts(2, false), { minRestRounds: 0 });

  assert.equal(assignments.length, matches.length);
  assert.ok(assignments.every((a) => a.courtId === null && a.round === null));
});

test('autoSchedule wraps to later rounds when there are more matches than courts', () => {
  const matches = roundRobinMatches(['a', 'b', 'c', 'd']); // 6 matches
  const assignments = autoSchedule(matches, courts(1), { minRestRounds: 0 });

  const rounds = assignments.map((a) => a.round!).sort((x, y) => x - y);
  assert.deepEqual(rounds, [0, 1, 2, 3, 4, 5]);
});

test('autoSchedule never reschedules an already-played match', () => {
  const matches = roundRobinMatches(['a', 'b', 'c', 'd']);
  matches[0]!.isResolved = true;
  const assignments = autoSchedule(matches, courts(2), { minRestRounds: 0 });

  assert.equal(assignments.length, matches.length - 1);
  assert.ok(!assignments.some((a) => a.matchId === 'm1'));
});

test('autoSchedule orders pools before knockout via stageSequence', () => {
  const pool = roundRobinMatches(['a', 'b', 'c', 'd'], 1);
  const semi: SchedulableMatch[] = [{ id: 'sf1', entrantIds: ['a', 'c'], stageSequence: 2, matchNumber: 1 }];
  const assignments = autoSchedule([...semi, ...pool], courts(2), { minRestRounds: 0 });

  const semiRound = assignmentFor(assignments, 'sf1').round!;
  const lastPoolRound = Math.max(...pool.map((m) => assignmentFor(assignments, m.id).round!));
  assert.ok(semiRound >= lastPoolRound, 'semifinal should not be scheduled before the last pool match');
});

test('the 4+5 uneven split schedules cleanly across two courts', () => {
  const poolA = roundRobinMatches(['a1', 'a2', 'a3', 'a4'], 1); // 6
  const poolB = roundRobinMatches(['b1', 'b2', 'b3', 'b4', 'b5'], 1).map((m, i) => ({
    ...m,
    id: `bm${i + 1}`,
    matchNumber: 100 + i,
  })); // 10
  const all = [...poolA, ...poolB];
  const cs = courts(2);
  const assignments = autoSchedule(all, cs, { minRestRounds: 1 });

  assert.equal(assignments.length, 16);
  const blocking = detectScheduleConflicts(all, cs, assignments, { minRestRounds: 1 }).filter(
    (i) => i.severity === 'blocking',
  );
  assert.deepEqual(blocking, []);
});

test('detects a team double-booked in the same round', () => {
  const matches: SchedulableMatch[] = [
    { id: 'm1', entrantIds: ['a', 'b'], stageSequence: 1, matchNumber: 1 },
    { id: 'm2', entrantIds: ['a', 'c'], stageSequence: 1, matchNumber: 2 },
  ];
  const assignments: ScheduleAssignment[] = [
    { matchId: 'm1', courtId: 'c1', round: 0 },
    { matchId: 'm2', courtId: 'c2', round: 0 },
  ];
  const issues = detectScheduleConflicts(matches, courts(2), assignments, { minRestRounds: 0 });
  const doubled = issues.filter((i) => i.code === 'schedule.team_double_booked');

  assert.equal(doubled.length, 2, 'both offending matches should be flagged');
  assert.ok(doubled.every((i) => i.severity === 'blocking'));
  assert.deepEqual(
    doubled.map((i) => i.entityRef?.id).sort(),
    ['m1', 'm2'],
  );
});

test('conflict messages name the offending team when names are supplied', () => {
  const matches: SchedulableMatch[] = [
    { id: 'm1', entrantIds: ['a', 'b'], stageSequence: 1, matchNumber: 1 },
    { id: 'm2', entrantIds: ['a', 'c'], stageSequence: 1, matchNumber: 2 },
  ];
  const assignments: ScheduleAssignment[] = [
    { matchId: 'm1', courtId: 'c1', round: 0 },
    { matchId: 'm2', courtId: 'c2', round: 0 },
  ];
  const names = new Map([['a', 'Smash Bandits']]);
  const issues = detectScheduleConflicts(matches, courts(2), assignments, { minRestRounds: 0 }, names);

  assert.ok(
    issues.some((i) => i.code === 'schedule.team_double_booked' && i.message.startsWith('Smash Bandits is scheduled')),
    'should name the team',
  );
});

test('falls back to "This team" when no names are supplied', () => {
  const matches: SchedulableMatch[] = [
    { id: 'm1', entrantIds: ['a', 'b'], stageSequence: 1, matchNumber: 1 },
    { id: 'm2', entrantIds: ['a', 'c'], stageSequence: 1, matchNumber: 2 },
  ];
  const issues = detectScheduleConflicts(
    matches,
    courts(2),
    [
      { matchId: 'm1', courtId: 'c1', round: 0 },
      { matchId: 'm2', courtId: 'c2', round: 0 },
    ],
    { minRestRounds: 0 },
  );

  assert.ok(issues.some((i) => i.message === 'This team is scheduled for two matches at the same time.'));
});

test('detects two matches in the same slot on one court', () => {
  const matches: SchedulableMatch[] = [
    { id: 'm1', entrantIds: ['a', 'b'], stageSequence: 1, matchNumber: 1 },
    { id: 'm2', entrantIds: ['c', 'd'], stageSequence: 1, matchNumber: 2 },
  ];
  const assignments: ScheduleAssignment[] = [
    { matchId: 'm1', courtId: 'c1', round: 0 },
    { matchId: 'm2', courtId: 'c1', round: 0 },
  ];
  const issues = detectScheduleConflicts(matches, courts(1), assignments, { minRestRounds: 0 });

  assert.ok(issues.some((i) => i.code === 'schedule.court_slot_double_booked' && i.severity === 'blocking'));
  assert.ok(issues.some((i) => i.message.includes('Court 1')), 'message should name the court');
});

test('flags insufficient rest as a warning, not a blocker', () => {
  const matches: SchedulableMatch[] = [
    { id: 'm1', entrantIds: ['a', 'b'], stageSequence: 1, matchNumber: 1 },
    { id: 'm2', entrantIds: ['a', 'c'], stageSequence: 1, matchNumber: 2 },
  ];
  const assignments: ScheduleAssignment[] = [
    { matchId: 'm1', courtId: 'c1', round: 0 },
    { matchId: 'm2', courtId: 'c1', round: 1 },
  ];
  const issues = detectScheduleConflicts(matches, courts(1), assignments, { minRestRounds: 1 });
  const rest = issues.find((i) => i.code === 'schedule.insufficient_rest');

  assert.ok(rest);
  assert.equal(rest.severity, 'warning');
  assert.equal(rest.entityRef?.id, 'm2', 'the later match is the one flagged');
});

test('back-to-back is clean when minRestRounds is 0', () => {
  const matches: SchedulableMatch[] = [
    { id: 'm1', entrantIds: ['a', 'b'], stageSequence: 1, matchNumber: 1 },
    { id: 'm2', entrantIds: ['a', 'c'], stageSequence: 1, matchNumber: 2 },
  ];
  const assignments: ScheduleAssignment[] = [
    { matchId: 'm1', courtId: 'c1', round: 0 },
    { matchId: 'm2', courtId: 'c1', round: 1 },
  ];
  const issues = detectScheduleConflicts(matches, courts(1), assignments, { minRestRounds: 0 });

  assert.ok(!issues.some((i) => i.code === 'schedule.insufficient_rest'));
});

test('flags matches left on a court that was marked unavailable', () => {
  const matches: SchedulableMatch[] = [{ id: 'm1', entrantIds: ['a', 'b'], stageSequence: 1, matchNumber: 1 }];
  const cs: SchedulableCourt[] = [{ id: 'c1', name: 'Back Court', isAvailable: false }];
  const issues = detectScheduleConflicts(matches, cs, [{ matchId: 'm1', courtId: 'c1', round: 0 }]);
  const issue = issues.find((i) => i.code === 'schedule.court_unavailable');

  assert.ok(issue);
  assert.equal(issue.severity, 'blocking');
  assert.ok(issue.message.includes('Back Court'));
});

test('warns about an unscheduled match, but not about a played one', () => {
  const matches: SchedulableMatch[] = [
    { id: 'm1', entrantIds: ['a', 'b'], stageSequence: 1, matchNumber: 1 },
    { id: 'm2', entrantIds: ['c', 'd'], stageSequence: 1, matchNumber: 2, isResolved: true },
  ];
  const issues = detectScheduleConflicts(matches, courts(1), []);
  const unscheduled = issues.filter((i) => i.code === 'schedule.unscheduled');

  assert.equal(unscheduled.length, 1);
  assert.equal(unscheduled[0]!.entityRef?.id, 'm1');
  assert.equal(unscheduled[0]!.severity, 'warning');
});
