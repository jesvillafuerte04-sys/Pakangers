import type { ValidationIssue } from './types.ts';

/**
 * Scheduling without a clock.
 *
 * Each court owns an ordered queue of matches. Position `round` across all
 * courts runs concurrently -- so "round 0" is whatever is on every court
 * first, "round 1" is what follows. This is how club events actually run
 * ("next match on court 2 when it frees up"), and it means rest is measured
 * in rounds rather than minutes. See docs/04-organizer-ui.md A8, which
 * explicitly says not to assume timed scheduling.
 */

export type SchedulableMatch = {
  id: string;
  /** Both sides. A bye has one; an unresolved knockout slot has none. */
  entrantIds: string[];
  /** Sort key 1 -- pools before semifinals, from stage.sequence. */
  stageSequence: number;
  /** Sort key 2. Only unique within a stage, hence the pair. */
  matchNumber: number;
  /** Already-played matches are never rescheduled. */
  isResolved?: boolean;
};

export type SchedulableCourt = {
  id: string;
  name: string;
  isAvailable: boolean;
};

/** Where one match sits: which court, and its position in that court's queue. */
export type ScheduleAssignment = {
  matchId: string;
  courtId: string | null;
  round: number | null;
};

export type ScheduleOptions = {
  /**
   * Rounds a team must sit out between its matches. 0 allows back-to-back;
   * 1 means at least one round off.
   */
  minRestRounds: number;
};

export const DEFAULT_SCHEDULE_OPTIONS: ScheduleOptions = { minRestRounds: 1 };

function isScheduled(a: ScheduleAssignment): a is ScheduleAssignment & { courtId: string; round: number } {
  return a.courtId !== null && a.round !== null;
}

function bySortOrder(a: SchedulableMatch, b: SchedulableMatch): number {
  return a.stageSequence - b.stageSequence || a.matchNumber - b.matchNumber;
}

/**
 * Every conflict a court-and-order schedule can contain, as structured issues
 * so the UI can render them inline on the offending match rather than as a
 * count at the top.
 */
export function detectScheduleConflicts(
  matches: SchedulableMatch[],
  courts: SchedulableCourt[],
  assignments: ScheduleAssignment[],
  opts: ScheduleOptions = DEFAULT_SCHEDULE_OPTIONS,
  /**
   * Optional entrant id -> display name, so messages can name the team rather
   * than saying "this team" -- two teams in one match can each be in conflict,
   * and undifferentiated messages read as duplicates.
   */
  entrantNames?: Map<string, string>,
): ValidationIssue[] {
  const nameOf = (id: string) => entrantNames?.get(id) ?? 'This team';
  const issues: ValidationIssue[] = [];
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const courtById = new Map(courts.map((c) => [c.id, c]));
  const scheduled = assignments.filter(isScheduled);

  // Two matches on the same court in the same position.
  const bySlot = new Map<string, string[]>();
  for (const a of scheduled) {
    const key = `${a.courtId}:${a.round}`;
    bySlot.set(key, [...(bySlot.get(key) ?? []), a.matchId]);
  }
  for (const [key, ids] of bySlot) {
    if (ids.length < 2) continue;
    const courtName = courtById.get(key.split(':')[0]!)?.name ?? 'that court';
    for (const id of ids) {
      issues.push({
        code: 'schedule.court_slot_double_booked',
        severity: 'blocking',
        message: `${ids.length} matches are set to start at the same time on ${courtName}.`,
        entityRef: { type: 'match', id },
      });
    }
  }

  // A team in two matches in the same round, and rest violations. Both come
  // from the same per-team list of rounds.
  const roundsByEntrant = new Map<string, { round: number; matchId: string }[]>();
  for (const a of scheduled) {
    for (const entrantId of matchById.get(a.matchId)?.entrantIds ?? []) {
      roundsByEntrant.set(entrantId, [...(roundsByEntrant.get(entrantId) ?? []), { round: a.round, matchId: a.matchId }]);
    }
  }

  for (const [entrantId, appearances] of roundsByEntrant) {
    const who = nameOf(entrantId);
    const sorted = [...appearances].sort((x, y) => x.round - y.round);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const gap = cur.round - prev.round;

      if (gap === 0) {
        for (const id of [prev.matchId, cur.matchId]) {
          issues.push({
            code: 'schedule.team_double_booked',
            severity: 'blocking',
            message: `${who} is scheduled for two matches at the same time.`,
            entityRef: { type: 'match', id },
          });
        }
      } else if (gap <= opts.minRestRounds) {
        issues.push({
          code: 'schedule.insufficient_rest',
          severity: 'warning',
          message:
            opts.minRestRounds === 1
              ? `${who} plays again immediately after its previous match, with no round off.`
              : `${who} gets ${gap} round(s) off here, fewer than the ${opts.minRestRounds} configured.`,
          entityRef: { type: 'match', id: cur.matchId },
        });
      }
    }
  }

  // Assigned to a court that has been marked unavailable.
  for (const a of scheduled) {
    const court = courtById.get(a.courtId);
    if (court && !court.isAvailable) {
      issues.push({
        code: 'schedule.court_unavailable',
        severity: 'blocking',
        message: `${court.name} is marked unavailable but still has matches on it.`,
        entityRef: { type: 'match', id: a.matchId },
      });
    }
  }

  // Not yet placed. A warning: an unscheduled match is normal mid-setup.
  const assignedIds = new Set(scheduled.map((a) => a.matchId));
  for (const m of matches) {
    if (m.isResolved || assignedIds.has(m.id)) continue;
    issues.push({
      code: 'schedule.unscheduled',
      severity: 'warning',
      message: 'This match has no court yet.',
      entityRef: { type: 'match', id: m.id },
    });
  }

  return issues;
}

/**
 * Greedy list scheduling: take matches in playing order and give each the
 * earliest round on the earliest available court that keeps every team out of
 * two places at once and honours the rest setting. Already-resolved matches
 * are left alone -- you cannot reschedule something already played.
 */
export function autoSchedule(
  matches: SchedulableMatch[],
  courts: SchedulableCourt[],
  opts: ScheduleOptions = DEFAULT_SCHEDULE_OPTIONS,
): ScheduleAssignment[] {
  const usableCourts = courts.filter((c) => c.isAvailable);
  const pending = matches.filter((m) => !m.isResolved).sort(bySortOrder);

  if (usableCourts.length === 0) {
    return pending.map((m) => ({ matchId: m.id, courtId: null, round: null }));
  }

  // court id -> round -> taken, and entrant -> rounds already used.
  const taken = new Map<string, Set<number>>(usableCourts.map((c) => [c.id, new Set<number>()]));
  const entrantRounds = new Map<string, number[]>();

  const restRespected = (entrantIds: string[], round: number): boolean =>
    entrantIds.every((id) =>
      (entrantRounds.get(id) ?? []).every((used) => Math.abs(used - round) > opts.minRestRounds),
    );

  const assignments: ScheduleAssignment[] = [];

  for (const m of pending) {
    let placed = false;

    for (let round = 0; !placed; round++) {
      for (const court of usableCourts) {
        if (taken.get(court.id)!.has(round)) continue;
        if (!restRespected(m.entrantIds, round)) continue;

        taken.get(court.id)!.add(round);
        for (const id of m.entrantIds) {
          entrantRounds.set(id, [...(entrantRounds.get(id) ?? []), round]);
        }
        assignments.push({ matchId: m.id, courtId: court.id, round });
        placed = true;
        break;
      }

      // Safety valve: with rest configured higher than the schedule can
      // satisfy, don't spin forever -- fall back to ignoring rest once we've
      // searched well past the theoretical minimum number of rounds.
      if (!placed && round > pending.length + opts.minRestRounds + 1) {
        const court = usableCourts[0]!;
        let round2 = 0;
        while (taken.get(court.id)!.has(round2)) round2++;
        taken.get(court.id)!.add(round2);
        for (const id of m.entrantIds) {
          entrantRounds.set(id, [...(entrantRounds.get(id) ?? []), round2]);
        }
        assignments.push({ matchId: m.id, courtId: court.id, round: round2 });
        placed = true;
      }
    }
  }

  return assignments;
}
