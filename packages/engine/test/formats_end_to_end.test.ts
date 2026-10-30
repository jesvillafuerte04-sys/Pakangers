/**
 * Plays every tournament format in the app from first serve to championship
 * point, and checks what the organizer actually relies on:
 *
 *   - every bracket's standings resolve under the USA Pickleball order
 *   - the right teams come out of the brackets and into the knockout
 *   - match numbers run 1..N with no gaps and no repeats
 *   - every bracket gets its own court, and no team or court is double-booked
 *
 * Results are deterministic (lower team number wins), so a failure here is a
 * real change in behaviour rather than a reroll.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings } from '../src/standings.ts';
import { autoSchedule, detectScheduleConflicts, DEFAULT_SCHEDULE_OPTIONS } from '../src/scheduling.ts';
import type { SchedulableCourt, SchedulableMatch } from '../src/scheduling.ts';
import { USAPA_TIEBREAKERS, type Match, type ScoringConfig } from '../src/types.ts';

const POOL_SCORING: ScoringConfig = { pointsToWin: 11, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' };
const KO_SCORING: ScoringConfig = { pointsToWin: 15, winBy: 'sudden_death', bestOf: 1, scoringType: 'side_out' };

/** "T03" -> 3. Lower number = stronger team, so every result is predictable. */
const rank = (id: string) => Number(id.slice(1));
const stronger = (a: string, b: string) => (rank(a) < rank(b) ? a : b);

function played(matchNumber: number, group: string | undefined, home: string, away: string, scoring: ScoringConfig): Match {
  const homeWins = stronger(home, away) === home;
  // Margin widens with the gap in strength, which gives point differential
  // something real to sort on.
  const margin = Math.min(scoring.pointsToWin - 1, Math.abs(rank(home) - rank(away)) + 1);
  return {
    matchNumber,
    round: 0,
    group,
    homeEntrantId: home,
    awayEntrantId: away,
    status: 'completed',
    source: 'generated',
    scoringConfig: scoring,
    games: [
      {
        gameNumber: 1,
        homeScore: homeWins ? scoring.pointsToWin : scoring.pointsToWin - margin,
        awayScore: homeWins ? scoring.pointsToWin - margin : scoring.pointsToWin,
      },
    ],
  };
}

type Format = {
  name: string;
  brackets: number;
  teamsPerBracket: number;
  /** Knockout stages after the brackets, in order, with their match counts. */
  knockout: { stage: string; matches: number }[];
  advancePerBracket: number;
};

const FORMATS: Format[] = [
  {
    name: 'Pakangers — 2 Brackets to Semifinals',
    brackets: 2, teamsPerBracket: 5, advancePerBracket: 2,
    knockout: [{ stage: 'Semi-Finals', matches: 2 }, { stage: 'Fight for 3rd Place', matches: 1 }, { stage: 'Championship', matches: 1 }],
  },
  {
    name: 'PPA Tour Style — 4 Brackets to Semi Finals',
    brackets: 4, teamsPerBracket: 4, advancePerBracket: 1,
    knockout: [{ stage: 'Semi-Finals', matches: 2 }, { stage: 'Fight for 3rd Place', matches: 1 }, { stage: 'Championship', matches: 1 }],
  },
  {
    name: 'PPA Tour Style — 4 Brackets to Quarter Finals',
    brackets: 4, teamsPerBracket: 4, advancePerBracket: 2,
    knockout: [{ stage: 'Quarter Finals', matches: 4 }, { stage: 'Semi-Finals', matches: 2 }, { stage: 'Fight for 3rd Place', matches: 1 }, { stage: 'Championship', matches: 1 }],
  },
  {
    name: 'PPA Tour Style — 8 Brackets to Quarter Finals',
    brackets: 8, teamsPerBracket: 4, advancePerBracket: 1,
    knockout: [{ stage: 'Quarter Finals', matches: 4 }, { stage: 'Semi-Finals', matches: 2 }, { stage: 'Fight for 3rd Place', matches: 1 }, { stage: 'Championship', matches: 1 }],
  },
  {
    name: 'PPA Tour Style — 8 Brackets to Round of 16',
    brackets: 8, teamsPerBracket: 4, advancePerBracket: 2,
    knockout: [{ stage: 'Round of 16', matches: 8 }, { stage: 'Quarter Finals', matches: 4 }, { stage: 'Semi-Finals', matches: 2 }, { stage: 'Fight for 3rd Place', matches: 1 }, { stage: 'Championship', matches: 1 }],
  },
  {
    name: '1 Bracket, round robin only',
    brackets: 1, teamsPerBracket: 6, advancePerBracket: 2,
    knockout: [{ stage: 'Championship', matches: 1 }],
  },
];

/** Round robin inside one bracket: every team plays every other team once. */
function bracketMatches(teams: string[], label: string, startNumber: number): Match[] {
  const out: Match[] = [];
  let n = startNumber;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      out.push(played(n++, label, teams[i]!, teams[j]!, POOL_SCORING));
    }
  }
  return out;
}

for (const fmt of FORMATS) {
  test(`${fmt.name}: brackets resolve, knockout fills, schedule is clean`, () => {
    // --- sample field -------------------------------------------------------
    const total = fmt.brackets * fmt.teamsPerBracket;
    const allTeams = Array.from({ length: total }, (_, i) => `T${String(i + 1).padStart(2, '0')}`);

    // Snake seeding, the way the app seeds brackets.
    const bracketTeams: string[][] = Array.from({ length: fmt.brackets }, () => []);
    allTeams.forEach((id, i) => {
      const row = Math.floor(i / fmt.brackets);
      const col = i % fmt.brackets;
      bracketTeams[row % 2 === 0 ? col : fmt.brackets - 1 - col]!.push(id);
    });

    // --- bracket play -------------------------------------------------------
    let matchNumber = 1;
    const allMatches: Match[] = [];
    const bracketLabels: string[] = [];
    const qualifiers: string[] = [];

    bracketTeams.forEach((teams, b) => {
      const label = `Bracket ${b + 1}`;
      bracketLabels.push(label);
      const matches = bracketMatches(teams, label, matchNumber);
      matchNumber += matches.length;
      allMatches.push(...matches);

      const standings = computeStandings(teams, matches, USAPA_TIEBREAKERS);

      assert.equal(standings.length, teams.length, `${label}: every team ranked`);
      assert.deepEqual(
        standings.map((s) => s.rank),
        teams.map((_, i) => i + 1),
        `${label}: ranks are 1..n with no ties left over`,
      );
      assert.ok(
        standings.every((s) => !s.unresolvedTie),
        `${label}: the USA Pickleball order settled every tie without a coin flip`,
      );
      // Round robin with a strict strength order: the standings must mirror it.
      assert.deepEqual(
        standings.map((s) => s.entrantId),
        [...teams].sort((a, b) => rank(a) - rank(b)),
        `${label}: stronger team finishes higher`,
      );

      qualifiers.push(...standings.slice(0, fmt.advancePerBracket).map((s) => s.entrantId));
    });

    // --- knockout -----------------------------------------------------------
    const expectedQualifiers = fmt.brackets * fmt.advancePerBracket;
    assert.equal(qualifiers.length, expectedQualifiers, 'the right number of teams advance');
    assert.equal(new Set(qualifiers).size, qualifiers.length, 'no team advances twice');

    let alive = [...qualifiers].sort((a, b) => rank(a) - rank(b));
    let semiLosers: string[] = [];
    let thirdPlace: string | null = null;

    for (const ko of fmt.knockout) {
      if (ko.stage === 'Fight for 3rd Place') {
        assert.equal(semiLosers.length, 2, 'the Fight for 3rd Place draws the two losing semifinalists');
        allMatches.push(played(matchNumber++, undefined, semiLosers[0]!, semiLosers[1]!, KO_SCORING));
        thirdPlace = stronger(semiLosers[0]!, semiLosers[1]!);
        continue;
      }
      if (ko.stage === 'Championship' && alive.length === 1) {
        // A single bracket with no knockout round: the bracket winner is champion.
        continue;
      }

      assert.equal(alive.length, ko.matches * 2, `${ko.stage}: field size matches the bracket slots`);

      const winners: string[] = [];
      const losers: string[] = [];
      for (let i = 0; i < alive.length; i += 2) {
        // Highest seed plays lowest seed, as a bracket does.
        const home = alive[i / 2]!;
        const away = alive[alive.length - 1 - i / 2]!;
        allMatches.push(played(matchNumber++, undefined, home, away, KO_SCORING));
        winners.push(stronger(home, away));
        losers.push(stronger(home, away) === home ? away : home);
      }
      if (ko.stage === 'Semi-Finals') semiLosers = losers;
      alive = winners;
    }

    assert.equal(alive.length, 1, 'exactly one champion');
    assert.equal(alive[0], 'T01', 'the strongest team wins, as the fixed results dictate');
    if (fmt.knockout.some((k) => k.stage === 'Fight for 3rd Place')) {
      assert.ok(thirdPlace && thirdPlace !== alive[0], 'third place is decided, and is not the champion');
    }

    // --- match numbering ----------------------------------------------------
    const numbers = allMatches.map((m) => m.matchNumber).sort((a, b) => a - b);
    assert.equal(new Set(numbers).size, numbers.length, 'match numbers are unique');
    assert.deepEqual(numbers, numbers.map((_, i) => i + 1), 'match numbers run 1..N with no gaps');

    // --- courts -------------------------------------------------------------
    const courts: SchedulableCourt[] = bracketLabels.map((_, i) => ({
      id: `court-${i + 1}`,
      name: `Court ${i + 1}`,
      isAvailable: true,
    }));

    const schedulable: SchedulableMatch[] = allMatches.map((m) => ({
      id: `m${m.matchNumber}`,
      entrantIds: [m.homeEntrantId!, m.awayEntrantId!],
      stageSequence: m.group ? 1 : 2,
      matchNumber: m.matchNumber,
      groupId: m.group ?? null,
      groupOrder: m.group ? bracketLabels.indexOf(m.group) : null,
    }));

    const assignments = autoSchedule(schedulable, courts, DEFAULT_SCHEDULE_OPTIONS);
    assert.equal(assignments.length, schedulable.length, 'every match gets placed');
    assert.ok(assignments.every((a) => a.courtId !== null), 'no match is left without a court');

    // One bracket, one court.
    for (const label of bracketLabels) {
      const ids = new Set(schedulable.filter((m) => m.groupId === label).map((m) => m.id));
      const used = new Set(assignments.filter((a) => ids.has(a.matchId)).map((a) => a.courtId));
      assert.equal(used.size, 1, `${label} is played entirely on one court`);
    }

    const conflicts = detectScheduleConflicts(schedulable, courts, assignments, DEFAULT_SCHEDULE_OPTIONS);
    const blocking = conflicts.filter((c) => c.severity === 'blocking');
    assert.deepEqual(blocking, [], `no court or team is double-booked: ${blocking.map((b) => b.message).join('; ')}`);
  });
}
