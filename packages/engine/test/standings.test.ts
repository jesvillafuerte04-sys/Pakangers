import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings } from '../src/standings.ts';
import type { Match, ScoringConfig } from '../src/types.ts';

const scoring: ScoringConfig = { pointsToWin: 11, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' };

let matchNumber = 0;
function match(home: string, away: string, homeScore: number, awayScore: number): Match {
  matchNumber += 1;
  return {
    matchNumber,
    round: 1,
    group: 'A',
    homeEntrantId: home,
    awayEntrantId: away,
    status: 'completed',
    source: 'generated',
    scoringConfig: scoring,
    games: [{ gameNumber: 1, homeScore, awayScore }],
  };
}

test('match_wins ranks by raw win count', () => {
  const matches = [
    match('A', 'B', 11, 5),
    match('A', 'C', 11, 9),
    match('B', 'C', 11, 3),
  ];
  const standings = computeStandings(['A', 'B', 'C'], matches, ['match_wins']);
  assert.deepEqual(standings.map((s) => s.entrantId), ['A', 'B', 'C']);
  assert.equal(standings[0]!.wins, 2);
});

test('point_differential breaks a tie on equal wins', () => {
  // A 2-1, B 2-1 (tied on wins), separated by point differential: A +16, B -4.
  const matches = [
    match('A', 'C', 11, 2),
    match('A', 'D', 11, 2),
    match('B', 'A', 11, 9),
    match('B', 'C', 11, 9),
    match('D', 'B', 11, 3),
    match('C', 'D', 11, 7),
  ];
  const standings = computeStandings(['A', 'B', 'C', 'D'], matches, ['match_wins', 'point_differential']);
  assert.equal(standings[0]!.entrantId, 'A');
  assert.equal(standings[1]!.entrantId, 'B');
  assert.equal(standings[0]!.wins, 2);
  assert.equal(standings[1]!.wins, 2);
  assert.ok(standings[0]!.pointDifferential > standings[1]!.pointDifferential);
  assert.ok(!standings[0]!.unresolvedTie && !standings[1]!.unresolvedTie);
});

test('head_to_head resolves a two-way tie on match_wins', () => {
  // A: 1-0 (beat B). B: 1-1 (lost to A, beat X). Both have 1 win -> tied on match_wins.
  // Their head-to-head game (A beat B) should rank A above B.
  const matches = [
    match('A', 'B', 11, 5),
    match('B', 'X', 11, 7),
  ];
  const standings = computeStandings(['A', 'B', 'X'], matches, ['match_wins', 'head_to_head']);
  assert.deepEqual(standings.map((s) => s.entrantId), ['A', 'B', 'X']);
  assert.ok(!standings[0]!.unresolvedTie && !standings[1]!.unresolvedTie);
});

test('a fully symmetric three-way circular tie stays unresolved through every tiebreaker', () => {
  // A beats B, B beats C, C beats A, identical scorelines -- every metric ties exactly.
  const matches = [
    match('A', 'B', 11, 5),
    match('B', 'C', 11, 5),
    match('C', 'A', 11, 5),
  ];
  const standings = computeStandings(
    ['A', 'B', 'C'],
    matches,
    ['match_wins', 'head_to_head', 'point_differential', 'points_scored'],
  );
  assert.ok(standings.every((s) => s.wins === 1));
  assert.ok(standings.every((s) => s.unresolvedTie === true), 'all three should be flagged unresolved');
});

test('point_differential resolves the tie when head-to-head is circular', () => {
  // Still a 3-cycle on wins (1-1 each) and head-to-head (each has exactly 1 sub-table win),
  // but the score margins differ, so point_differential can separate them.
  const matches = [
    match('A', 'B', 11, 5), // A +6
    match('B', 'C', 11, 5), // B +6
    match('C', 'A', 11, 9), // C +2, A -2
  ];
  const standings = computeStandings(
    ['A', 'B', 'C'],
    matches,
    ['match_wins', 'head_to_head', 'point_differential', 'points_scored'],
  );
  assert.deepEqual(standings.map((s) => s.entrantId), ['A', 'B', 'C']);
  assert.ok(standings.every((s) => !s.unresolvedTie));
});

test('a bye counts as an automatic win with no points recorded', () => {
  const byeMatch: Match = {
    matchNumber: 1, round: 1, homeEntrantId: 'A', awayEntrantId: null,
    status: 'bye', source: 'generated', scoringConfig: scoring, games: [],
  };
  const standings = computeStandings(['A', 'B'], [byeMatch], ['match_wins']);
  const a = standings.find((s) => s.entrantId === 'A')!;
  assert.equal(a.wins, 1);
  assert.equal(a.pointsFor, 0);
});
