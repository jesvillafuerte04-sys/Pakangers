import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTeams, validateQualificationRule } from '../src/validation.ts';
import { validateScoringConfig, validateGameScore } from '../src/scoring.ts';

test('detects a player assigned to two teams', () => {
  const players = [{ id: 'p1', name: 'Maria Cruz' }];
  const teams = [
    { id: 't1', name: 'Team A', memberIds: ['p1'], expectedSize: 1 },
    { id: 't2', name: 'Team B', memberIds: ['p1'], expectedSize: 1 },
  ];
  const issues = validateTeams(players, teams);
  assert.ok(issues.some((i) => i.code === 'player.on_multiple_teams' && i.severity === 'blocking'));
});

test('detects a team with no players', () => {
  const issues = validateTeams([], [{ id: 't1', name: 'Empty Team', memberIds: [], expectedSize: 2 }]);
  assert.ok(issues.some((i) => i.code === 'team.no_players'));
});

test('detects a team with the wrong number of players for its division', () => {
  const players = [{ id: 'p1', name: 'A' }];
  const issues = validateTeams(players, [{ id: 't1', name: 'Solo', memberIds: ['p1'], expectedSize: 2 }]);
  assert.ok(issues.some((i) => i.code === 'team.wrong_size'));
});

test('warns (not blocks) about a registered player on no team', () => {
  const players = [{ id: 'p1', name: 'Unassigned Pat' }];
  const issues = validateTeams(players, []);
  const issue = issues.find((i) => i.code === 'player.unassigned');
  assert.ok(issue);
  assert.equal(issue!.severity, 'warning');
});

test('a fully valid roster produces no issues', () => {
  const players = [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }];
  const teams = [{ id: 't1', name: 'Team AB', memberIds: ['p1', 'p2'], expectedSize: 2 }];
  assert.deepEqual(validateTeams(players, teams), []);
});

test('qualification asking for more teams than the group has is blocking', () => {
  const issues = validateQualificationRule({ method: 'top_n', value: 3 }, 2);
  assert.ok(issues.some((i) => i.code === 'qualification.exceeds_group_size'));
});

test('qualification within group size produces no issues', () => {
  assert.deepEqual(validateQualificationRule({ method: 'top_n', value: 2 }, 4), []);
});

test('scoring: points to win must be a positive whole number', () => {
  const issues = validateScoringConfig({ pointsToWin: 0, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' });
  assert.ok(issues.some((i) => i.code === 'scoring.points_to_win_invalid'));
});

test('scoring: best of must be 1, 3, or 5', () => {
  const issues = validateScoringConfig({ pointsToWin: 11, winBy: 'sudden_death', bestOf: 2 as 1, scoringType: 'side_out' });
  assert.ok(issues.some((i) => i.code === 'scoring.best_of_invalid'));
});

test('scoring: a cap below points-to-win is blocking', () => {
  const issues = validateScoringConfig({ pointsToWin: 15, winBy: 'win_by_two', bestOf: 1, scoringType: 'side_out', cap: 12 });
  assert.ok(issues.some((i) => i.code === 'scoring.cap_below_points_to_win'));
});

test('game score: a winning score below points-to-win is blocking', () => {
  const cfg = { pointsToWin: 11, winBy: 'sudden_death' as const, bestOf: 1 as const, scoringType: 'side_out' as const };
  const issues = validateGameScore(cfg, { gameNumber: 1, homeScore: 9, awayScore: 7 });
  assert.ok(issues.some((i) => i.code === 'scoring.winner_below_points_to_win'));
});

test('game score: win-by-two violated when the margin is one', () => {
  const cfg = { pointsToWin: 11, winBy: 'win_by_two' as const, bestOf: 1 as const, scoringType: 'side_out' as const };
  const issues = validateGameScore(cfg, { gameNumber: 1, homeScore: 12, awayScore: 11 });
  assert.ok(issues.some((i) => i.code === 'scoring.win_by_two_violated'));
});

test('game score: sudden death allows a one-point margin right at the target', () => {
  const cfg = { pointsToWin: 11, winBy: 'sudden_death' as const, bestOf: 1 as const, scoringType: 'side_out' as const };
  assert.deepEqual(validateGameScore(cfg, { gameNumber: 1, homeScore: 11, awayScore: 10 }), []);
});

test('game score: a tied score has no winner', () => {
  const cfg = { pointsToWin: 11, winBy: 'sudden_death' as const, bestOf: 1 as const, scoringType: 'side_out' as const };
  const issues = validateGameScore(cfg, { gameNumber: 1, homeScore: 10, awayScore: 10 });
  assert.ok(issues.some((i) => i.code === 'scoring.tied_score'));
});

test('game score: a win-by-two score that hits the cap exactly is valid', () => {
  const cfg = { pointsToWin: 11, winBy: 'win_by_two' as const, bestOf: 1 as const, scoringType: 'side_out' as const, cap: 15 };
  assert.deepEqual(validateGameScore(cfg, { gameNumber: 1, homeScore: 15, awayScore: 14 }), []);
});
