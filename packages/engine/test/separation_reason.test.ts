/**
 * The standings must be able to say why they are in that order.
 *
 * Built from a real bracket that exposed the problem: four teams level on 4
 * wins, with the team holding the best overall point difference finishing
 * fourth. The explanation the app shows is generated from these values, so a
 * wrong reason here is a wrong reason on screen.
 *
 * Run: node --test --experimental-strip-types test/separation_reason.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings } from '../src/standings.ts';
import { USAPA_TIEBREAKERS, type Match, type ScoringConfig } from '../src/types.ts';

const CFG: ScoringConfig = { pointsToWin: 11, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' };

/** [home, away, home score, away score] */
const RESULTS: [string, string, number, number][] = [
  ['Abby', 'Jessa', 5, 11], ['Erin', 'Nath', 7, 11], ['Channihn', 'Mars', 9, 11],
  ['Ria', 'Jessa', 10, 11], ['Abby', 'Mars', 5, 11], ['Erin', 'Channihn', 8, 11],
  ['Ria', 'Nath', 7, 11], ['Jessa', 'Mars', 9, 11], ['Abby', 'Erin', 7, 11],
  ['Ria', 'Mars', 11, 9], ['Nath', 'Channihn', 7, 11], ['Jessa', 'Erin', 9, 11],
  ['Ria', 'Channihn', 7, 11], ['Mars', 'Erin', 9, 11], ['Nath', 'Abby', 11, 9],
  ['Ria', 'Erin', 10, 11], ['Channihn', 'Abby', 11, 0], ['Nath', 'Jessa', 7, 11],
  ['Ria', 'Abby', 8, 11], ['Channihn', 'Jessa', 9, 11], ['Mars', 'Nath', 11, 10],
];

const MATCHES: Match[] = RESULTS.map(([home, away, hs, as], i) => ({
  matchNumber: i + 1, round: 0, group: 'A',
  homeEntrantId: home, awayEntrantId: away,
  status: 'completed', source: 'generated', scoringConfig: CFG,
  games: [{ gameNumber: 1, homeScore: hs, awayScore: as }],
}));

const TEAMS = [...new Set(RESULTS.flatMap(([h, a]) => [h, a]))];
const standings = () => computeStandings(TEAMS, MATCHES, USAPA_TIEBREAKERS);

test('a four-way tie is settled on head-to-head, not on overall point difference', () => {
  const table = standings();

  assert.deepEqual(
    table.slice(0, 4).map((s) => s.entrantId),
    ['Erin', 'Mars', 'Jessa', 'Channihn'],
  );
  assert.ok(table.slice(0, 4).every((s) => s.wins === 4), 'all four are level on wins');

  const channihn = table.find((s) => s.entrantId === 'Channihn')!;
  const erin = table.find((s) => s.entrantId === 'Erin')!;
  assert.ok(
    channihn.pointDifferential > erin.pointDifferential,
    'the team finishing fourth has the better overall point difference',
  );
  assert.equal(channihn.pointDifferential, 18);
  assert.equal(erin.pointDifferential, 2);
});

test('each team records the criterion that put the team above it ahead', () => {
  const table = standings();
  const by = (id: string) => table.find((s) => s.entrantId === id)!;

  assert.equal(by('Erin').separatedFromAbove ?? null, null, 'the bracket winner has nothing above it');

  // Third is separated from second by the head-to-head mini table among all
  // four: two wins against one. Overall point difference never comes into it.
  const jessa = by('Jessa').separatedFromAbove!;
  assert.equal(jessa.tiebreaker, 'head_to_head');
  assert.equal(jessa.tiedCount, 4);
  assert.equal(jessa.aboveValue, 2);
  assert.equal(jessa.value, 1);

  // First from second: the two of them played, and Erin won that match.
  const mars = by('Mars').separatedFromAbove!;
  assert.equal(mars.tiebreaker, 'head_to_head');
  assert.equal(mars.tiedCount, 2);
  assert.equal(mars.aboveValue, 1);
  assert.equal(mars.value, 0);
});

test('a reason is never claimed on a criterion that did not decide anything', () => {
  for (const s of standings()) {
    const r = s.separatedFromAbove;
    if (!r) continue;
    assert.ok(
      r.aboveValue > r.value,
      `${s.entrantId}: ${r.tiebreaker} is reported as deciding, but ${r.aboveValue} is not better than ${r.value}`,
    );
  }
});

test('teams level on wins are compared only on matches between themselves', () => {
  const table = standings();
  // Mars beat Jessa head to head overall too, but what matters is that the
  // recorded reason is the mini-table count, not the whole-bracket record.
  const jessa = table.find((s) => s.entrantId === 'Jessa')!.separatedFromAbove!;
  assert.ok(jessa.value < 4, 'the head-to-head count is within the tied group, not the full round robin');
});
