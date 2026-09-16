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

test('autoSchedule wave-based: assigns 1 bracket per court, running to completion before next wave (2 courts, 4 brackets)', () => {
  // 4 brackets: A (ord 0), B (ord 1), C (ord 2), D (ord 3) with 6 matches each
  const poolMatches: SchedulableMatch[] = [];
  let idCounter = 1;
  for (let grp = 0; grp < 4; grp++) {
    for (let m = 1; m <= 6; m++) {
      poolMatches.push({
        id: `m${idCounter++}`,
        entrantIds: [`t_${grp}_${m}a`, `t_${grp}_${m}b`],
        stageSequence: 1,
        matchNumber: m,
        groupOrder: grp,
      });
    }
  }

  // 2 knockout matches (stageSequence: 2, no groupOrder)
  const koMatches: SchedulableMatch[] = [
    { id: 'ko1', entrantIds: ['t1', 't2'], stageSequence: 2, matchNumber: 1 },
    { id: 'ko2', entrantIds: ['t3', 't4'], stageSequence: 2, matchNumber: 2 },
  ];

  const cs = courts(2);
  const assignments = autoSchedule([...poolMatches, ...koMatches], cs);

  // Bracket A (grp 0) should be entirely on court 1, rounds 0..5
  const grpAMatches = assignments.filter((a) => {
    const m = poolMatches.find((x) => x.id === a.matchId);
    return m?.groupOrder === 0;
  });
  assert.equal(grpAMatches.length, 6);
  assert.ok(grpAMatches.every((a) => a.courtId === 'c1'));
  assert.deepEqual(grpAMatches.map((a) => a.round).sort((x, y) => x! - y!), [0, 1, 2, 3, 4, 5]);

  // Bracket B (grp 1) should be entirely on court 2, rounds 0..5
  const grpBMatches = assignments.filter((a) => {
    const m = poolMatches.find((x) => x.id === a.matchId);
    return m?.groupOrder === 1;
  });
  assert.equal(grpBMatches.length, 6);
  assert.ok(grpBMatches.every((a) => a.courtId === 'c2'));
  assert.deepEqual(grpBMatches.map((a) => a.round).sort((x, y) => x! - y!), [0, 1, 2, 3, 4, 5]);

  // Wave 2: Bracket C (grp 2) on court 1, rounds 6..11
  const grpCMatches = assignments.filter((a) => {
    const m = poolMatches.find((x) => x.id === a.matchId);
    return m?.groupOrder === 2;
  });
  assert.equal(grpCMatches.length, 6);
  assert.ok(grpCMatches.every((a) => a.courtId === 'c1'));
  assert.deepEqual(grpCMatches.map((a) => a.round).sort((x, y) => x! - y!), [6, 7, 8, 9, 10, 11]);

  // Wave 2: Bracket D (grp 3) on court 2, rounds 6..11
  const grpDMatches = assignments.filter((a) => {
    const m = poolMatches.find((x) => x.id === a.matchId);
    return m?.groupOrder === 3;
  });
  assert.equal(grpDMatches.length, 6);
  assert.ok(grpDMatches.every((a) => a.courtId === 'c2'));
  assert.deepEqual(grpDMatches.map((a) => a.round).sort((x, y) => x! - y!), [6, 7, 8, 9, 10, 11]);

  // Knockout matches should only begin at round 12 or later
  const koAssignments = assignments.filter((a) => a.matchId === 'ko1' || a.matchId === 'ko2');
  assert.equal(koAssignments.length, 2);
  assert.ok(koAssignments.every((a) => a.round! >= 12));
});

test('autoSchedule wave-based: 1 court runs Bracket A to completion before starting Bracket B', () => {
  const matches: SchedulableMatch[] = [
    { id: 'a1', entrantIds: ['1', '2'], stageSequence: 1, matchNumber: 1, groupOrder: 0 },
    { id: 'a2', entrantIds: ['3', '4'], stageSequence: 1, matchNumber: 2, groupOrder: 0 },
    { id: 'b1', entrantIds: ['5', '6'], stageSequence: 1, matchNumber: 1, groupOrder: 1 },
    { id: 'b2', entrantIds: ['7', '8'], stageSequence: 1, matchNumber: 2, groupOrder: 1 },
  ];
  const cs = courts(1);
  const assignments = autoSchedule(matches, cs);

  assert.equal(assignments.length, 4);
  assert.ok(assignments.every((a) => a.courtId === 'c1'));
  // Bracket A must run first in rounds 0 and 1
  const a1 = assignments.find((x) => x.matchId === 'a1')!;
  const a2 = assignments.find((x) => x.matchId === 'a2')!;
  assert.equal(a1.round, 0);
  assert.equal(a2.round, 1);
  // Bracket B must run after Bracket A finishes (rounds 2 and 3)
  const b1 = assignments.find((x) => x.matchId === 'b1')!;
  const b2 = assignments.find((x) => x.matchId === 'b2')!;
  assert.equal(b1.round, 2);
  assert.equal(b2.round, 3);
});
